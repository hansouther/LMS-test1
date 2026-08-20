"""Iteration 11: Weakness analysis + CSV exports for admin (global) and proctor (school-scoped)."""
import os
import io
import csv
import pytest
import requests

def _load_base():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if not v:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    v = line.split("=", 1)[1].strip()
                    break
    return v.rstrip("/")


BASE_URL = _load_base()
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@lms.id", "password": "Admin@12345"}
PROCTOR = {"email": "proktor@lms.id", "password": "Proktor@12345"}

NUSANTARA_NAMES = {"Ahmad Fauzi", "Budi Santoso", "Siti Nurhaliza", "Andi Pratama", "Dewi Lestari"}
HARAPAN_NAMES = {"Rizki", "Maya"}  # Should NOT appear in proctor recap


def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def admin_sess():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def proctor_sess():
    return _login(PROCTOR)


# ---------- Admin analysis (GLOBAL) ----------
class TestAdminAnalysis:
    def test_admin_analysis_global(self, admin_sess):
        r = admin_sess.get(f"{API}/admin/analysis", timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert set(data.keys()) >= {"scores", "recap", "items", "summary"}
        summary = data["summary"]
        assert summary["total_students"] == 7, f"expected 7 got {summary['total_students']}"
        assert len(data["recap"]) == 7
        # competency_avg present
        assert "competency_avg" in summary
        ca = summary["competency_avg"]
        assert "numerasi" in ca and "literasi" in ca
        # recap rows carry competency fields
        for row in data["recap"]:
            assert "numerasi_pct" in row
            assert "literasi_pct" in row
            assert "weakest_competency" in row
            assert "trend" in row
            assert row["trend"] in ("naik", "turun", "stabil")

    def _csv_check(self, sess, path, expected_header0):
        r = sess.get(f"{API}/admin/analysis/{path}", timeout=60)
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/csv")
        reader = csv.reader(io.StringIO(r.text))
        rows = list(reader)
        assert len(rows) >= 2, f"expected header + data, got {len(rows)}"
        assert rows[0][0] == expected_header0
        return rows

    def test_admin_scores_csv(self, admin_sess):
        self._csv_check(admin_sess, "scores.csv", "Nama Siswa")

    def test_admin_recap_csv(self, admin_sess):
        rows = self._csv_check(admin_sess, "recap.csv", "Nama Siswa")
        # header contains Numerasi (%) / Literasi (%)
        header = rows[0]
        assert "Numerasi (%)" in header
        assert "Literasi (%)" in header
        assert "Kompetensi Terlemah" in header
        assert "Tren" in header

    def test_admin_items_csv(self, admin_sess):
        rows = self._csv_check(admin_sess, "items.csv", "Try Out")
        header = rows[0]
        assert "Kompetensi" in header
        assert "Tingkat Kesulitan" in header


# ---------- Proctor analysis (SCHOOL-SCOPED) ----------
class TestProctorAnalysis:
    def test_proctor_analysis_scoped(self, proctor_sess):
        r = proctor_sess.get(f"{API}/proctor/analysis", timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        summary = data["summary"]
        assert summary["total_students"] == 5, f"expected 5 got {summary['total_students']}"
        assert len(data["recap"]) == 5
        names = {row["name"] for row in data["recap"]}
        assert names == NUSANTARA_NAMES, f"got {names}"
        # Ensure no Harapan Bangsa student leaked in
        assert not (names & HARAPAN_NAMES)
        # School isolation via school_name
        for row in data["recap"]:
            assert row["school_name"] == "SMA Nusantara 1"

    def test_proctor_scores_csv(self, proctor_sess):
        r = proctor_sess.get(f"{API}/proctor/analysis/scores.csv", timeout=60)
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/csv")
        # Confirm no Harapan Bangsa student names leaked
        for name in HARAPAN_NAMES:
            assert name not in r.text, f"{name} leaked in proctor scores CSV"

    def test_proctor_recap_csv(self, proctor_sess):
        r = proctor_sess.get(f"{API}/proctor/analysis/recap.csv", timeout=60)
        assert r.status_code == 200
        for name in HARAPAN_NAMES:
            assert name not in r.text

    def test_proctor_items_csv(self, proctor_sess):
        r = proctor_sess.get(f"{API}/proctor/analysis/items.csv", timeout=60)
        assert r.status_code == 200
        assert "Kompetensi" in r.text.split("\n")[0]

    def test_admin_endpoints_forbidden_for_proctor(self, proctor_sess):
        r = proctor_sess.get(f"{API}/admin/analysis", timeout=30)
        assert r.status_code in (401, 403)


# ---------- Competency field on questions + import template ----------
class TestQuestionCompetency:
    def test_template_includes_competency(self, admin_sess):
        r = admin_sess.get(f"{API}/admin/questions/template", timeout=30)
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/csv")
        header = r.text.splitlines()[0].lower()
        assert "competency" in header

    def test_create_question_with_competency_persists(self, admin_sess):
        # Find a tryout
        r = admin_sess.get(f"{API}/admin/tryouts", timeout=30)
        assert r.status_code == 200
        tryouts = r.json()
        assert tryouts, "no tryouts available"
        tid = tryouts[0]["id"]
        # Create question
        body = {
            "type": "single",
            "text": "TEST_iter11 competency question",
            "options": [{"id": "o1", "text": "A"}, {"id": "o2", "text": "B"}],
            "correct_answers": ["o1"],
            "points": 1,
            "order": 999,
            "competency": "numerasi",
        }
        cr = admin_sess.post(f"{API}/admin/tryouts/{tid}/questions", json=body, timeout=30)
        assert cr.status_code == 200, cr.text
        qid = cr.json()["id"]
        try:
            # Verify persisted
            lr = admin_sess.get(f"{API}/admin/tryouts/{tid}/questions", timeout=30)
            assert lr.status_code == 200
            match = [q for q in lr.json() if q["id"] == qid]
            assert match and match[0]["competency"] == "numerasi"
            # Update to literasi
            body["competency"] = "literasi"
            ur = admin_sess.put(f"{API}/admin/questions/{qid}", json=body, timeout=30)
            assert ur.status_code == 200
            lr2 = admin_sess.get(f"{API}/admin/tryouts/{tid}/questions", timeout=30)
            match2 = [q for q in lr2.json() if q["id"] == qid]
            assert match2[0]["competency"] == "literasi"
        finally:
            admin_sess.delete(f"{API}/admin/questions/{qid}", timeout=30)

    def test_csv_import_with_competency(self, admin_sess):
        r = admin_sess.get(f"{API}/admin/tryouts", timeout=30)
        tid = r.json()[0]["id"]
        csv_text = (
            "type,text,option_a,option_b,option_c,option_d,correct,points,competency\n"
            "single,\"TEST_iter11 import num\",1,2,3,4,B,1,numerasi\n"
            "single,\"TEST_iter11 import lit\",a,b,c,d,A,1,literasi\n"
        )
        files = {"file": ("q.csv", csv_text.encode("utf-8"), "text/csv")}
        ir = admin_sess.post(f"{API}/admin/tryouts/{tid}/questions/import", files=files, timeout=30)
        assert ir.status_code == 200, ir.text
        assert ir.json()["imported"] == 2
        # Verify persistence + cleanup
        lr = admin_sess.get(f"{API}/admin/tryouts/{tid}/questions", timeout=30)
        imported = [q for q in lr.json() if q["text"].startswith("TEST_iter11 import")]
        comps = {q["competency"] for q in imported}
        assert {"numerasi", "literasi"} <= comps
        for q in imported:
            admin_sess.delete(f"{API}/admin/questions/{q['id']}", timeout=30)


# ---------- Regression: proctor reports + analytics still work ----------
class TestProctorRegression:
    def test_proctor_reports(self, proctor_sess):
        r = proctor_sess.get(f"{API}/proctor/reports", timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_proctor_reports_csv(self, proctor_sess):
        r = proctor_sess.get(f"{API}/proctor/reports/csv", timeout=30)
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/csv")

    def test_proctor_analytics(self, proctor_sess):
        r = proctor_sess.get(f"{API}/proctor/analytics", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "per_student" in data and "class_trend" in data
