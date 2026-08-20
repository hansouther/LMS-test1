"""Iteration 12: Bulk-competency tagging + Tutor docs (CV/certificates) admin view/download."""
import io
import os
import uuid
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
TRYOUT_ID = "to_3"
ORIG_COMP = {"to_3_q1": "numerasi", "to_3_q2": "numerasi", "to_3_q3": "numerasi", "to_3_q4": "literasi", "to_3_q5": "literasi"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def admin_sess():
    return _login(ADMIN)


# ---------- BULK COMPETENCY ----------
class TestBulkCompetency:
    def test_seed_state(self, admin_sess):
        r = admin_sess.get(f"{API}/admin/tryouts/{TRYOUT_ID}/questions", timeout=30)
        assert r.status_code == 200
        qs = r.json()
        assert len(qs) == 5, f"expected 5 seed questions on {TRYOUT_ID}"
        cmap = {q["id"]: q.get("competency", "umum") for q in qs}
        for qid, comp in ORIG_COMP.items():
            assert cmap.get(qid) == comp, f"seed drift on {qid}: {cmap.get(qid)} != {comp}"

    def test_bulk_apply_umum(self, admin_sess):
        r = admin_sess.post(
            f"{API}/admin/tryouts/{TRYOUT_ID}/questions/bulk-competency",
            json={"question_ids": ["to_3_q1", "to_3_q2", "to_3_q4"], "competency": "umum"},
            timeout=30,
        )
        assert r.status_code == 200
        assert r.json()["updated"] == 3
        # verify persistence
        r2 = admin_sess.get(f"{API}/admin/tryouts/{TRYOUT_ID}/questions", timeout=30)
        cmap = {q["id"]: q.get("competency") for q in r2.json()}
        assert cmap["to_3_q1"] == "umum"
        assert cmap["to_3_q2"] == "umum"
        assert cmap["to_3_q4"] == "umum"
        # untouched
        assert cmap["to_3_q3"] == "numerasi"
        assert cmap["to_3_q5"] == "literasi"

    def test_bulk_empty_returns_400(self, admin_sess):
        r = admin_sess.post(
            f"{API}/admin/tryouts/{TRYOUT_ID}/questions/bulk-competency",
            json={"question_ids": [], "competency": "numerasi"},
            timeout=30,
        )
        assert r.status_code == 400

    def test_bulk_invalid_competency_defaults_umum(self, admin_sess):
        # Endpoint normalizes any invalid value to 'umum'
        r = admin_sess.post(
            f"{API}/admin/tryouts/{TRYOUT_ID}/questions/bulk-competency",
            json={"question_ids": ["to_3_q1"], "competency": "banana"},
            timeout=30,
        )
        assert r.status_code == 200
        r2 = admin_sess.get(f"{API}/admin/tryouts/{TRYOUT_ID}/questions", timeout=30)
        cmap = {q["id"]: q.get("competency") for q in r2.json()}
        assert cmap["to_3_q1"] == "umum"

    def test_revert_seed(self, admin_sess):
        # Revert all 5 back to original values via bulk endpoint
        num_ids = [k for k, v in ORIG_COMP.items() if v == "numerasi"]
        lit_ids = [k for k, v in ORIG_COMP.items() if v == "literasi"]
        r1 = admin_sess.post(
            f"{API}/admin/tryouts/{TRYOUT_ID}/questions/bulk-competency",
            json={"question_ids": num_ids, "competency": "numerasi"},
            timeout=30,
        )
        r2 = admin_sess.post(
            f"{API}/admin/tryouts/{TRYOUT_ID}/questions/bulk-competency",
            json={"question_ids": lit_ids, "competency": "literasi"},
            timeout=30,
        )
        assert r1.status_code == 200 and r2.status_code == 200
        r3 = admin_sess.get(f"{API}/admin/tryouts/{TRYOUT_ID}/questions", timeout=30)
        cmap = {q["id"]: q.get("competency") for q in r3.json()}
        for qid, comp in ORIG_COMP.items():
            assert cmap[qid] == comp, f"revert failed on {qid}: {cmap[qid]}"

    def test_unauth_blocked(self):
        r = requests.post(
            f"{API}/admin/tryouts/{TRYOUT_ID}/questions/bulk-competency",
            json={"question_ids": ["to_3_q1"], "competency": "umum"},
            timeout=30,
        )
        assert r.status_code in (401, 403)


# ---------- TUTOR DOCS: register ephemeral tutor, upload CV+cert, admin view/download ----------
@pytest.fixture(scope="module")
def ephemeral_tutor():
    """Register a tutor, upload CV + certificate. Yields (tutor_id, tutor_email, cv_url, cert_url).
    Deletes user at the end.
    """
    email = f"TEST_tutor_{uuid.uuid4().hex[:8]}@lms.id"
    password = "Tutor@12345"
    ts = requests.Session()
    r = ts.post(
        f"{API}/auth/register/tutor",
        json={"name": "TEST Tutor Docs", "email": email, "password": password, "phone": "0800"},
        timeout=30,
    )
    assert r.status_code == 200, f"register/tutor: {r.status_code} {r.text}"
    tutor = r.json()
    tutor_id = tutor["id"]

    # Upload CV (PDF)
    pdf_bytes = b"%PDF-1.4\n%TEST tutor CV\n%%EOF"
    r_cv = ts.post(f"{API}/auth/upload-doc", files={"file": ("cv.pdf", pdf_bytes, "application/pdf")}, timeout=30)
    assert r_cv.status_code == 200, f"upload CV: {r_cv.status_code} {r_cv.text}"
    cv_url = r_cv.json()["url"]

    # Upload Certificate (PNG < 2MB) - minimal 1x1 png
    png_bytes = bytes.fromhex(
        "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C6300010000000500010D0A2DB40000000049454E44AE426082"
    )
    r_cert = ts.post(
        f"{API}/auth/upload-doc",
        files={"file": ("cert.png", png_bytes, "image/png")},
        timeout=30,
    )
    assert r_cert.status_code == 200, f"upload cert: {r_cert.status_code} {r_cert.text}"
    cert_url = r_cert.json()["url"]
    cert_name = r_cert.json()["name"]

    # Save on tutor profile
    r_prof = ts.put(
        f"{API}/auth/profile",
        json={"cv_url": cv_url, "cv_name": "cv.pdf", "certificates": [{"name": cert_name, "url": cert_url}]},
        timeout=30,
    )
    assert r_prof.status_code == 200, f"profile update: {r_prof.status_code} {r_prof.text}"

    yield {"id": tutor_id, "email": email, "cv_url": cv_url, "cert_url": cert_url}

    # Cleanup: admin deletes tutor
    admin = _login(ADMIN)
    admin.delete(f"{API}/admin/users/{tutor_id}", timeout=30)


class TestTutorDocs:
    def test_tutor_appears_in_admin_list_with_docs(self, admin_sess, ephemeral_tutor):
        r = admin_sess.get(f"{API}/admin/users", timeout=30)
        assert r.status_code == 200
        users = r.json()
        match = [u for u in users if u["id"] == ephemeral_tutor["id"]]
        assert match, "ephemeral tutor not visible to admin"
        t = match[0]
        assert t.get("cv_url") == ephemeral_tutor["cv_url"]
        certs = t.get("certificates") or []
        assert len(certs) == 1
        assert certs[0]["url"] == ephemeral_tutor["cert_url"]

    def test_admin_can_download_cv(self, admin_sess, ephemeral_tutor):
        # cv_url looks like /api/files/<path>; strip leading /api
        url = ephemeral_tutor["cv_url"]
        assert url.startswith("/api/")
        full = f"{BASE_URL}{url}"
        r = admin_sess.get(full, timeout=30)
        assert r.status_code == 200, f"admin CV fetch: {r.status_code} {r.text[:200]}"
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content.startswith(b"%PDF")

    def test_admin_can_download_cert(self, admin_sess, ephemeral_tutor):
        full = f"{BASE_URL}{ephemeral_tutor['cert_url']}"
        r = admin_sess.get(full, timeout=30)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("image/")
        assert r.content[:4] == b"\x89PNG"

    def test_unauth_cannot_download(self, ephemeral_tutor):
        full = f"{BASE_URL}{ephemeral_tutor['cv_url']}"
        r = requests.get(full, timeout=30)
        assert r.status_code in (401, 403)
