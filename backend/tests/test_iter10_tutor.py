"""Iteration 10: Tutor registration + document upload + admin verification."""
import io
import os
import time
import uuid
import requests
import pytest

def _load_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        try:
            with open("/app/frontend/.env") as fh:
                for line in fh:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        url = line.strip().split("=", 1)[1]
                        break
        except Exception:
            pass
    if not url:
        raise RuntimeError("REACT_APP_BACKEND_URL not set")
    return url.rstrip("/")

BASE_URL = _load_url()
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@lms.id"
ADMIN_PASSWORD = "Admin@12345"


def _mk_session():
    return requests.Session()


def _login(sess, email, password):
    r = sess.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    return r


@pytest.fixture(scope="module")
def created_tutor_ids():
    ids = []
    yield ids
    # Cleanup as admin
    admin = _mk_session()
    r = _login(admin, ADMIN_EMAIL, ADMIN_PASSWORD)
    if r.status_code == 200:
        for uid in ids:
            try:
                admin.delete(f"{API}/admin/users/{uid}", timeout=10)
            except Exception:
                pass


@pytest.fixture(scope="module")
def tutor_email():
    return f"TEST_tutor_{uuid.uuid4().hex[:8]}@lms.id"


def _mini_pdf():
    return b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"


def _mini_png():
    # 1x1 transparent PNG
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\x0f"
        b"\x00\x00\x01\x01\x00\x05\xfe\x02\xfe\xa5\x8a\x9d\xc3\x00\x00\x00\x00IEND\xaeB`\x82"
    )


class TestRegisterTutor:
    def test_register_tutor_creates_pending(self, tutor_email, created_tutor_ids):
        sess = _mk_session()
        r = sess.post(f"{API}/auth/register/tutor", json={
            "name": "Test Tutor",
            "email": tutor_email,
            "password": "Passw0rd!",
            "phone": "081200000000",
        }, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["role"] == "tutor"
        assert data["status"] == "pending"
        assert data["email"] == tutor_email.lower()
        assert "id" in data
        created_tutor_ids.append(data["id"])

    def test_duplicate_email_400(self, tutor_email):
        sess = _mk_session()
        r = sess.post(f"{API}/auth/register/tutor", json={
            "name": "Dup", "email": tutor_email, "password": "Passw0rd!", "phone": "0"
        }, timeout=15)
        assert r.status_code == 400

    def test_pending_tutor_cannot_access_portal(self, tutor_email):
        sess = _mk_session()
        assert _login(sess, tutor_email, "Passw0rd!").status_code == 200
        r = sess.get(f"{API}/tutor/dashboard", timeout=15)
        assert r.status_code == 403


class TestUploadDoc:
    def test_upload_cv_pdf(self, tutor_email):
        sess = _mk_session()
        _login(sess, tutor_email, "Passw0rd!")
        files = {"file": ("cv.pdf", io.BytesIO(_mini_pdf()), "application/pdf")}
        r = sess.post(f"{API}/auth/upload-doc", files=files, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["url"].startswith("/api/files/")
        assert data["name"] == "cv.pdf"

    def test_upload_cert_png(self, tutor_email):
        sess = _mk_session()
        _login(sess, tutor_email, "Passw0rd!")
        files = {"file": ("cert.png", io.BytesIO(_mini_png()), "image/png")}
        r = sess.post(f"{API}/auth/upload-doc", files=files, timeout=20)
        assert r.status_code == 200, r.text

    def test_reject_bad_extension(self, tutor_email):
        sess = _mk_session()
        _login(sess, tutor_email, "Passw0rd!")
        files = {"file": ("evil.exe", io.BytesIO(b"MZ\x00\x00"), "application/octet-stream")}
        r = sess.post(f"{API}/auth/upload-doc", files=files, timeout=20)
        assert r.status_code == 400

    def test_reject_image_over_2mb(self, tutor_email):
        sess = _mk_session()
        _login(sess, tutor_email, "Passw0rd!")
        big = b"\x00" * (2 * 1024 * 1024 + 100)
        files = {"file": ("big.jpg", io.BytesIO(big), "image/jpeg")}
        r = sess.post(f"{API}/auth/upload-doc", files=files, timeout=30)
        assert r.status_code == 400
        assert "2 MB" in r.text or "2 MB" in r.json().get("detail", "")


class TestProfileAndAdminApprove:
    _state = {}

    def test_save_profile_with_cv_and_certs(self, tutor_email):
        sess = _mk_session()
        _login(sess, tutor_email, "Passw0rd!")
        # upload CV
        f1 = {"file": ("cv.pdf", io.BytesIO(_mini_pdf()), "application/pdf")}
        cv = sess.post(f"{API}/auth/upload-doc", files=f1, timeout=20).json()
        # upload cert
        f2 = {"file": ("cert.png", io.BytesIO(_mini_png()), "image/png")}
        cert = sess.post(f"{API}/auth/upload-doc", files=f2, timeout=20).json()
        r = sess.put(f"{API}/auth/profile", json={
            "phone": "081211112222",
            "cv_url": cv["url"], "cv_name": cv["name"],
            "certificates": [{"url": cert["url"], "name": cert["name"], "type": cert["type"]}],
        }, timeout=15)
        assert r.status_code == 200, r.text
        me = r.json()
        assert me["cv_url"] == cv["url"]
        assert len(me["certificates"]) == 1
        TestProfileAndAdminApprove._state["user_id"] = me["id"]

    def test_admin_can_see_and_approve(self, tutor_email):
        admin = _mk_session()
        assert _login(admin, ADMIN_EMAIL, ADMIN_PASSWORD).status_code == 200
        r = admin.get(f"{API}/admin/users", timeout=15)
        assert r.status_code == 200
        users = r.json()
        found = next((u for u in users if u.get("email") == tutor_email.lower()), None)
        assert found is not None
        assert found.get("cv_url")
        assert found.get("certificates") and len(found["certificates"]) >= 1
        # approve
        uid = found["id"]
        r = admin.put(f"{API}/admin/users/{uid}", json={"status": "approved"}, timeout=15)
        assert r.status_code == 200

    def test_tutor_can_access_portal_after_approval(self, tutor_email):
        sess = _mk_session()
        _login(sess, tutor_email, "Passw0rd!")
        r = sess.get(f"{API}/tutor/dashboard", timeout=15)
        assert r.status_code == 200


class TestBecomeTutor:
    def test_student_can_become_tutor(self, created_tutor_ids):
        email = f"TEST_student2tutor_{uuid.uuid4().hex[:8]}@lms.id"
        sess = _mk_session()
        r = sess.post(f"{API}/auth/register", json={
            "name": "Student2Tutor", "email": email, "password": "Passw0rd!"
        }, timeout=15)
        assert r.status_code == 200
        uid = r.json()["id"]
        created_tutor_ids.append(uid)
        assert r.json()["role"] == "student"
        r2 = sess.post(f"{API}/auth/become-tutor", timeout=15)
        assert r2.status_code == 200, r2.text
        data = r2.json()
        assert data["role"] == "tutor"
        assert data["status"] == "pending"


class TestRegression:
    def test_student_register_still_works(self, created_tutor_ids):
        email = f"TEST_student_{uuid.uuid4().hex[:8]}@lms.id"
        sess = _mk_session()
        r = sess.post(f"{API}/auth/register", json={
            "name": "Reg Student", "email": email, "password": "Passw0rd!"
        }, timeout=15)
        assert r.status_code == 200
        created_tutor_ids.append(r.json()["id"])

    def test_proctor_register_still_works(self, created_tutor_ids):
        email = f"TEST_proctor_{uuid.uuid4().hex[:8]}@lms.id"
        sess = _mk_session()
        r = sess.post(f"{API}/auth/register/proctor", json={
            "name": "PIC", "email": email, "password": "Passw0rd!", "school_name": "SMA Test"
        }, timeout=15)
        assert r.status_code == 200
        created_tutor_ids.append(r.json()["id"])

    def test_demo_admin_login(self):
        sess = _mk_session()
        assert _login(sess, ADMIN_EMAIL, ADMIN_PASSWORD).status_code == 200
