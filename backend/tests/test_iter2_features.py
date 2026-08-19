"""Backend tests for iteration 2 features:
- Course content (lessons + exercise CRUD, seed data)
- Bulk question import (CSV) + template download
- Student course learn (grade total_points + average, exclusion of exercises from tryouts list)
- Tutor favorites -> Proctor visibility (school-filtered)
- Email-triggering endpoints (assign_slot, create_tryout with published=True) — verify no 5xx.
- File upload (small file) + download roundtrip.
"""
import io
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

CREDS = {
    "admin": ("admin@lms.id", "Admin@12345"),
    "tutor": ("tutor@lms.id", "Tutor@12345"),
    "proctor": ("proktor@lms.id", "Proktor@12345"),
    # Use fresh students to avoid conflict with existing attempts on to_3
    "student_new": ("dewi@lms.id", "Siswa@12345"),
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
def tutor(): return _login("tutor")

@pytest.fixture(scope="module")
def proctor(): return _login("proctor")


# ---------- Course content (admin) ----------
class TestCourseContent:
    def test_seeded_course_utbk_has_content(self, admin):
        r = admin.get(f"{API}/admin/courses/course_utbk/content")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["course"]["id"] == "course_utbk"
        assert len(data["lessons"]) >= 2
        assert len(data["exercises"]) >= 1
        assert any(e["id"] == "ex_utbk_1" for e in data["exercises"])

    def test_create_youtube_lesson_and_list(self, admin):
        body = {
            "title": "TEST_YouTube Lesson iter2",
            "description": "test",
            "video_type": "youtube",
            "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "attachments": [],
            "order": 0,
        }
        r = admin.post(f"{API}/admin/courses/course_utbk/lessons", json=body)
        assert r.status_code == 200, r.text
        lesson = r.json()
        assert lesson["title"].startswith("TEST_")
        assert lesson["video_type"] == "youtube"
        # verify persistence
        r2 = admin.get(f"{API}/admin/courses/course_utbk/content")
        titles = [l["title"] for l in r2.json()["lessons"]]
        assert body["title"] in titles
        # cleanup
        admin.delete(f"{API}/admin/lessons/{lesson['id']}")

    def test_create_exercise(self, admin):
        body = {"title": "TEST_Exercise iter2", "subject": "Latihan",
                "duration_minutes": 10, "description": "smoke"}
        r = admin.post(f"{API}/admin/courses/course_utbk/exercises", json=body)
        assert r.status_code == 200, r.text
        ex = r.json()
        assert ex["kind"] == "exercise"
        assert ex["course_id"] == "course_utbk"
        assert ex["published"] is True
        # exercise should not appear on standalone tryout list
        r2 = admin.get(f"{API}/admin/tryouts")
        assert not any(t["id"] == ex["id"] for t in r2.json())
        # cleanup
        admin.delete(f"{API}/admin/tryouts/{ex['id']}")


# ---------- Bulk import questions ----------
class TestBulkImport:
    def test_template_download(self, admin):
        r = admin.get(f"{API}/admin/questions/template")
        assert r.status_code == 200
        assert "type,text" in r.text
        assert r.headers.get("content-type", "").startswith("text/csv")

    def test_csv_import_flow(self, admin):
        # Create a fresh tryout for import
        body = {"title": "TEST_ImportTO iter2", "subject": "Umum",
                "duration_minutes": 30, "published": False, "kind": "standalone"}
        r = admin.post(f"{API}/admin/tryouts", json=body)
        assert r.status_code == 200
        to_id = r.json()["id"]

        csv_body = (
            "type,text,option_a,option_b,option_c,option_d,correct,points\n"
            "single,\"2+2?\",1,4,5,6,B,5\n"
            "truefalse,\"Bumi bulat\",,,,,benar,5\n"
            "essay,\"Ibu kota?\",,,,,\"jakarta|dki jakarta\",5\n"
        )
        files = {"file": ("q.csv", csv_body.encode("utf-8"), "text/csv")}
        r2 = admin.post(f"{API}/admin/tryouts/{to_id}/questions/import", files=files)
        assert r2.status_code == 200, r2.text
        data = r2.json()
        assert data["imported"] == 3, data
        assert data["errors"] == []

        # verify questions persisted with correct mappings
        r3 = admin.get(f"{API}/admin/tryouts/{to_id}/questions")
        qs = r3.json()
        assert len(qs) == 3
        by_type = {q["type"]: q for q in qs}
        assert by_type["single"]["correct_answers"] == ["o2"]  # B -> o2
        assert by_type["truefalse"]["correct_answers"] == ["true"]
        assert set(by_type["essay"]["correct_answers"]) == {"jakarta", "dki jakarta"}

        # cleanup
        admin.delete(f"{API}/admin/tryouts/{to_id}")


# ---------- Student course learn ----------
class TestStudentCourseLearn:
    def test_learn_returns_grade_and_exercise(self):
        s = _login("student_new")  # dewi is not enrolled in course_utbk by default; enroll first
        # try learn; if 403, enroll
        r = s.get(f"{API}/student/courses/course_utbk/learn")
        if r.status_code == 403:
            er = s.post(f"{API}/student/courses/course_utbk/enroll")
            assert er.status_code in (200, 400), er.text
            r = s.get(f"{API}/student/courses/course_utbk/learn")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "grade" in data and "total_points" in data["grade"] and "average" in data["grade"]
        assert any(e["id"] == "ex_utbk_1" for e in data["exercises"])
        assert len(data["lessons"]) >= 2

    def test_standalone_tryouts_excludes_exercises(self):
        s = _login("student_new")
        r = s.get(f"{API}/student/tryouts")
        assert r.status_code == 200
        items = r.json()
        assert all(t["id"] != "ex_utbk_1" for t in items), "Course exercise leaked into standalone tryouts"


# ---------- Tutor favorites -> Proctor visibility ----------
class TestFavoritesFlow:
    def test_tutor_set_favorite_and_class_students_shows_flag(self, tutor):
        # Set favorite for student_budi in course_utbk
        r = tutor.post(f"{API}/tutor/favorites",
                       json={"student_id": "student_budi", "course_id": "course_utbk",
                             "note": "TEST_Konsisten & rajin"})
        assert r.status_code == 200, r.text

        # Verify via tutor's class_students endpoint (slot_chem is tutor_demo's confirmed class)
        r2 = tutor.get(f"{API}/tutor/classes/slot_chem/students")
        assert r2.status_code == 200
        students = r2.json()["students"]
        budi = next((s for s in students if s["id"] == "student_budi"), None)
        assert budi is not None
        assert budi["is_favorite"] is True
        assert "TEST_" in (budi["favorite_note"] or "")

    def test_proctor_sees_only_own_school_favorites(self, proctor):
        r = proctor.get(f"{API}/proctor/favorites")
        assert r.status_code == 200, r.text
        favs = r.json()
        assert len(favs) >= 1
        # All favorites' students must be from proctor's school (Nusantara 1)
        # student_budi belongs to school_nusantara — should be present
        assert any(f["student_id"] == "student_budi" for f in favs)
        # And no student from school 2 (rizki/maya) should appear
        assert not any(f["student_id"] in ("student_rizki", "student_maya") for f in favs)
        # each row includes course_title + tutor_name
        for f in favs:
            assert "course_title" in f
            assert "tutor_name" in f

    def test_tutor_remove_favorite_cleanup(self, tutor):
        r = tutor.delete(f"{API}/tutor/favorites",
                         params={"student_id": "student_budi", "course_id": "course_utbk"})
        assert r.status_code == 200


# ---------- Email-triggering endpoints (no 5xx) ----------
class TestEmailTriggers:
    def test_publish_tryout_triggers_bg_no_5xx(self, admin):
        body = {"title": "TEST_PublishedTO iter2", "subject": "Umum",
                "duration_minutes": 30, "published": True, "kind": "standalone"}
        r = admin.post(f"{API}/admin/tryouts", json=body)
        assert r.status_code == 200, r.text
        to_id = r.json()["id"]
        admin.delete(f"{API}/admin/tryouts/{to_id}")

    def test_assign_slot_triggers_bg_no_5xx(self, admin):
        # Create a fresh slot & bid then assign
        slot = admin.post(f"{API}/admin/slots", json={
            "title": "TEST_Slot iter2", "subject": "Matematika",
            "date": "2030-01-15", "start_time": "10:00", "end_time": "12:00",
            "required_qualifications": ["Matematika"], "course_id": "course_utbk",
            "open_to_all": False, "notes": "smoke",
        }).json()
        # tutor places bid
        t = _login("tutor")
        r = t.post(f"{API}/tutor/slots/{slot['id']}/bid", json={"message": "iter2"})
        assert r.status_code == 200, r.text
        bids = admin.get(f"{API}/admin/slots/{slot['id']}/bids").json()
        assert len(bids) >= 1
        bid_id = bids[0]["id"]
        r2 = admin.post(f"{API}/admin/slots/{slot['id']}/assign/{bid_id}")
        assert r2.status_code == 200, r2.text
        # cleanup: delete slot (also removes bids)
        admin.delete(f"{API}/admin/slots/{slot['id']}")


# ---------- File upload roundtrip ----------
class TestFileUpload:
    def test_upload_and_download(self, admin):
        payload = b"hello iter2 upload"
        files = {"file": ("test.txt", payload, "text/plain")}
        r = admin.post(f"{API}/upload", files=files)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "url" in data and data["url"].startswith("/api/files/")
        # download
        r2 = admin.get(f"{BASE_URL}{data['url']}")
        assert r2.status_code == 200
        assert r2.content == payload
