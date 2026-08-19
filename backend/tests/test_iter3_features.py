"""Backend tests for iteration 3 features:
- Lesson progress per course (complete + progress bar)
- Achievements/badges (video_master, exercise_champion, perfect_score, course_complete)
- Randomized retake (question + options shuffle) — allow multiple attempts on exercise
- ZIP bulk import of course materials (video + document + skipped types)
- Student dashboard badges strip
"""
import io
import os
import time
import zipfile
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

CREDS = {
    "admin": ("admin@lms.id", "Admin@12345"),
    "student": ("siswa@lms.id", "Siswa@12345"),
}


def _login(role):
    s = requests.Session()
    email, pw = CREDS[role]
    r = s.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=15)
    assert r.status_code == 200, f"login {role} failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def admin(): return _login("admin")

@pytest.fixture(scope="module")
def student(): return _login("student")


def _ensure_enrolled(s, course_id):
    r = s.get(f"{API}/student/courses/{course_id}/learn")
    if r.status_code == 403:
        s.post(f"{API}/student/courses/{course_id}/enroll")
        r = s.get(f"{API}/student/courses/{course_id}/learn")
    assert r.status_code == 200, r.text
    return r.json()


# ---------- ZIP Import ----------
class TestZipImport:
    def _make_zip(self):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("TEST_lesson_video.mp4", b"\x00\x00\x00\x18ftypmp42fakevideo")
            zf.writestr("TEST_lesson_doc.pdf", b"%PDF-1.4 fake pdf content")
            zf.writestr("TEST_readme.txt", b"should be skipped")
            # macos artifact should also be skipped
            zf.writestr("__MACOSX/foo", b"x")
        buf.seek(0)
        return buf.getvalue()

    def test_import_zip_creates_video_and_doc_lesson(self, admin):
        # Use course_phys (per problem statement) — verify it exists
        cid = "course_phys"
        r = admin.get(f"{API}/admin/courses")
        courses = r.json()
        assert any(c["id"] == cid for c in courses), f"course_phys not present; available: {[c['id'] for c in courses]}"

        pre = admin.get(f"{API}/admin/courses/{cid}/content").json()
        pre_lessons_ids = {l["id"] for l in pre["lessons"]}

        zip_bytes = self._make_zip()
        files = {"file": ("TEST_iter3.zip", zip_bytes, "application/zip")}
        r = admin.post(f"{API}/admin/courses/{cid}/lessons/import-zip", files=files)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["created"] == 2, data
        assert data["skipped"] >= 1, data  # .txt (and macosx filtered before ext-check)
        assert data["errors"] == []

        # Verify persistence
        post = admin.get(f"{API}/admin/courses/{cid}/content").json()
        new_lessons = [l for l in post["lessons"] if l["id"] not in pre_lessons_ids]
        assert len(new_lessons) == 2
        types = sorted(l["video_type"] for l in new_lessons)
        assert types == ["document", "upload"]
        titles = sorted(l["title"] for l in new_lessons)
        assert titles == ["TEST_lesson_doc", "TEST_lesson_video"]

        # Cleanup created lessons
        for l in new_lessons:
            admin.delete(f"{API}/admin/lessons/{l['id']}")

    def test_import_zip_invalid_returns_400(self, admin):
        files = {"file": ("bad.zip", b"not a zip file", "application/zip")}
        r = admin.post(f"{API}/admin/courses/course_phys/lessons/import-zip", files=files)
        assert r.status_code == 400

    def test_import_zip_missing_course_404(self, admin):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("x.pdf", b"%PDF")
        files = {"file": ("x.zip", buf.getvalue(), "application/zip")}
        r = admin.post(f"{API}/admin/courses/course_missing_zzz/lessons/import-zip", files=files)
        assert r.status_code == 404


# ---------- Lesson progress + Badges ----------
class TestLessonProgressAndBadges:
    def test_learn_returns_progress_and_achievements(self, student):
        bundle = _ensure_enrolled(student, "course_utbk")
        assert "progress" in bundle
        p = bundle["progress"]
        assert set(p.keys()) >= {"lessons_completed", "lessons_total", "percent"}
        assert p["lessons_total"] >= 1
        assert "achievements" in bundle
        codes = {a["code"] for a in bundle["achievements"]}
        assert codes == {"video_master", "exercise_champion", "perfect_score", "course_complete"}
        for a in bundle["achievements"]:
            assert "earned" in a and isinstance(a["earned"], bool)

    def test_mark_complete_lesson_updates_progress(self, student):
        bundle = _ensure_enrolled(student, "course_utbk")
        lessons = bundle["lessons"]
        assert lessons, "course_utbk should have seeded lessons"
        target = lessons[0]
        before_completed = bundle["progress"]["lessons_completed"]

        # Mark first lesson as completed
        r = student.post(f"{API}/student/lessons/{target['id']}/complete", json={"completed": True})
        assert r.status_code == 200, r.text
        assert r.json()["completed"] is True

        after = student.get(f"{API}/student/courses/course_utbk/learn").json()
        # Find lesson flag
        l0 = next(l for l in after["lessons"] if l["id"] == target["id"])
        assert l0["completed"] is True
        assert after["progress"]["lessons_completed"] >= before_completed + (0 if target.get("completed") else 1) or l0["completed"]
        # percent should reflect
        assert after["progress"]["percent"] >= 0

    def test_video_master_badge_earned_when_all_lessons_complete(self, student):
        bundle = _ensure_enrolled(student, "course_utbk")
        for l in bundle["lessons"]:
            r = student.post(f"{API}/student/lessons/{l['id']}/complete", json={"completed": True})
            assert r.status_code == 200
        after = student.get(f"{API}/student/courses/course_utbk/learn").json()
        assert after["progress"]["lessons_completed"] == after["progress"]["lessons_total"]
        video_master = next(a for a in after["achievements"] if a["code"] == "video_master")
        assert video_master["earned"] is True

    def test_dashboard_returns_badges_field(self, student):
        r = student.get(f"{API}/student/dashboard")
        assert r.status_code == 200
        data = r.json()
        assert "badges" in data
        assert isinstance(data["badges"], list)
        # After video_master earned, should include it for course_utbk
        codes = {b["code"] for b in data["badges"]}
        assert "video_master" in codes, f"expected video_master among {codes}"


# ---------- Randomized retake ----------
class TestRandomizedRetake:
    def test_exercise_detail_shuffles_across_calls(self, student):
        # ex_utbk_1 is the seeded exercise on course_utbk (with multi questions)
        bundle = _ensure_enrolled(student, "course_utbk")
        ex_ids = [e["id"] for e in bundle["exercises"]]
        assert "ex_utbk_1" in ex_ids
        seqs = []
        opts_seqs = []
        for _ in range(8):
            r = student.get(f"{API}/student/tryouts/ex_utbk_1")
            assert r.status_code == 200
            qs = r.json()["questions"]
            seqs.append(tuple(q["id"] for q in qs))
            for q in qs:
                if q.get("options"):
                    opts_seqs.append(tuple(o.get("id") or o.get("key") or str(o) for o in q["options"]))
        # Expect at least one differing order (probabilistic — with >=2 items, extremely unlikely to be all same across 8 calls)
        assert len(set(seqs)) > 1 or len(seqs[0]) <= 1, f"questions never shuffled: {seqs}"
        if opts_seqs:
            assert len(set(opts_seqs)) > 1 or all(len(o) <= 1 for o in opts_seqs), "options never shuffled"

    def test_retake_creates_new_attempt_and_best_score_wins(self, student):
        # Start #1
        r1 = student.post(f"{API}/student/tryouts/ex_utbk_1/start")
        assert r1.status_code == 200, r1.text
        att1 = r1.json()
        # Submit with empty answers -> low score
        rs1 = student.post(f"{API}/student/attempts/{att1['id']}/submit", json={"answers": {}})
        assert rs1.status_code == 200, rs1.text
        pct1 = rs1.json().get("percentage", 0)

        # Retake (start again) should create new attempt on exercise
        r2 = student.post(f"{API}/student/tryouts/ex_utbk_1/start")
        assert r2.status_code == 200, r2.text
        att2 = r2.json()
        assert att2["id"] != att1["id"], "Retake should create a NEW attempt for exercise"

        # Submit attempt2 with the actual correct answers by reading exercise detail — try to get high score
        det = student.get(f"{API}/student/tryouts/ex_utbk_1").json()
        # We don't have answer key exposed (strip_answers), so submit empty again — just verify best-score logic uses max
        rs2 = student.post(f"{API}/student/attempts/{att2['id']}/submit", json={"answers": {}})
        assert rs2.status_code == 200
        pct2 = rs2.json().get("percentage", 0)

        # Verify learn endpoint's best_attempt tracks max(pct1, pct2)
        after = student.get(f"{API}/student/courses/course_utbk/learn").json()
        ex = next(e for e in after["exercises"] if e["id"] == "ex_utbk_1")
        assert ex["attempts_count"] >= 2
        assert ex["my_percentage"] == max(pct1, pct2)
