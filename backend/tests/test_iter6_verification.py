"""
Iterasi 6 backend tests: registration + account verification workflow + school isolation.

Covers:
- Student /auth/register creates status=pending
- Proctor /auth/register/proctor creates status=pending, school_name_text stored, school_id=None
- Pending users cannot access portal endpoints (403 "Akun Anda menunggu verifikasi admin")
- Admin approves via PUT /admin/users/{id} (status)
- Admin links school via PUT /admin/users/{id} (school_id)
- After approval, student/proctor can hit their portal endpoints
- Proctor school isolation: only sees students from linked school
- Proctor /trainings returns courses enrolled by school students
- Regression: demo accounts (admin/student/proctor/tutor) still login without verification
"""
import os
import time
import uuid
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@lms.id", "password": "Admin@12345"}
DEMO_STUDENT = {"email": "siswa@lms.id", "password": "Siswa@12345"}
DEMO_PROCTOR = {"email": "proktor@lms.id", "password": "Proktor@12345"}
DEMO_TUTOR = {"email": "tutor@lms.id", "password": "Tutor@12345"}
SCHOOL_NUSANTARA = "school_nusantara"

created_test_user_ids = []


def _sess():
    return requests.Session()


def _login(sess, creds):
    r = sess.post(f"{API}/auth/login", json=creds, timeout=10)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="module")
def admin_sess():
    s = _sess()
    _login(s, ADMIN)
    yield s
    # Cleanup all TEST_ users created in this module
    for uid in created_test_user_ids:
        try:
            s.delete(f"{API}/admin/users/{uid}", timeout=10)
        except Exception:
            pass


def _unique_email(prefix):
    return f"TEST_{prefix}_{uuid.uuid4().hex[:8]}@example.com"


# ---------- 1. Student registration → pending ----------
class TestStudentRegistration:
    def test_register_student_creates_pending(self):
        s = _sess()
        email = _unique_email("student")
        body = {
            "name": "TEST Student One",
            "email": email,
            "password": "Passw0rd!",
            "phone": "0812000001",
            "school_id": SCHOOL_NUSANTARA,
            "grade": "Kelas 12 IPA",
            "goal": "Lolos UTBK",
        }
        r = s.post(f"{API}/auth/register", json=body, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == email.lower()
        assert data["role"] == "student"
        assert data["status"] == "pending"
        assert data["school_id"] == SCHOOL_NUSANTARA
        assert data["grade"] == "Kelas 12 IPA"
        assert data["goal"] == "Lolos UTBK"
        assert "password_hash" not in data
        created_test_user_ids.append(data["id"])

        # /auth/me returns pending too (session cookie set)
        me = s.get(f"{API}/auth/me", timeout=10)
        assert me.status_code == 200
        assert me.json()["status"] == "pending"

        # Portal endpoint blocked
        r = s.get(f"{API}/student/dashboard", timeout=10)
        assert r.status_code == 403
        assert "verifikasi" in r.json().get("detail", "").lower()

    def test_duplicate_email_rejected(self):
        s = _sess()
        email = _unique_email("dup")
        body = {"name": "TEST", "email": email, "password": "x123456", "school_id": SCHOOL_NUSANTARA, "grade": "12", "goal": "g"}
        r1 = s.post(f"{API}/auth/register", json=body, timeout=10)
        assert r1.status_code == 200
        created_test_user_ids.append(r1.json()["id"])
        r2 = _sess().post(f"{API}/auth/register", json=body, timeout=10)
        assert r2.status_code == 400


# ---------- 2. Proctor registration → pending, school_id=None, school_name_text set ----------
class TestProctorRegistration:
    def test_register_proctor_creates_pending(self):
        s = _sess()
        email = _unique_email("proctor")
        body = {
            "school_name": "SMA TEST Free Text",
            "name": "TEST PIC",
            "email": email,
            "password": "Passw0rd!",
            "phone": "0812000002",
        }
        r = s.post(f"{API}/auth/register/proctor", json=body, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["role"] == "proctor"
        assert data["status"] == "pending"
        assert data["school_id"] is None
        assert data["school_name_text"] == "SMA TEST Free Text"
        created_test_user_ids.append(data["id"])

        # Blocked from proctor portal
        r = s.get(f"{API}/proctor/dashboard", timeout=10)
        assert r.status_code == 403


# ---------- 3. Admin verification flows ----------
class TestAdminVerification:
    def test_pending_users_listed_and_approve_reject(self, admin_sess):
        # Create a student pending
        stu = _sess()
        email = _unique_email("approveflow")
        body = {"name": "TEST ApproveMe", "email": email, "password": "x123456",
                "school_id": SCHOOL_NUSANTARA, "grade": "12", "goal": "target", "phone": "081"}
        r = stu.post(f"{API}/auth/register", json=body, timeout=10)
        assert r.status_code == 200
        uid = r.json()["id"]
        created_test_user_ids.append(uid)

        # Admin lists users, finds it as pending
        r = admin_sess.get(f"{API}/admin/users", timeout=10)
        assert r.status_code == 200
        users = r.json()
        found = next((u for u in users if u["id"] == uid), None)
        assert found is not None
        assert found["status"] == "pending"
        assert found["grade"] == "12"
        assert found["goal"] == "target"
        assert found.get("school_name")  # school linked via school_id

        # Approve
        r = admin_sess.put(f"{API}/admin/users/{uid}", json={"status": "approved"}, timeout=10)
        assert r.status_code == 200

        # Login as approved user and check portal access
        s2 = _sess()
        _login(s2, {"email": email, "password": "x123456"})
        me = s2.get(f"{API}/auth/me", timeout=10).json()
        assert me["status"] == "approved"
        r = s2.get(f"{API}/student/dashboard", timeout=10)
        assert r.status_code == 200

    def test_reject_status_blocks_portal(self, admin_sess):
        stu = _sess()
        email = _unique_email("reject")
        body = {"name": "TEST Reject", "email": email, "password": "x123456",
                "school_id": SCHOOL_NUSANTARA, "grade": "12", "goal": "g", "phone": "081"}
        r = stu.post(f"{API}/auth/register", json=body, timeout=10)
        uid = r.json()["id"]
        created_test_user_ids.append(uid)

        r = admin_sess.put(f"{API}/admin/users/{uid}", json={"status": "rejected"}, timeout=10)
        assert r.status_code == 200

        s2 = _sess()
        _login(s2, {"email": email, "password": "x123456"})
        # rejected users still can't access portal
        r = s2.get(f"{API}/student/dashboard", timeout=10)
        assert r.status_code == 403

    def test_link_school_and_change_role(self, admin_sess):
        # Register proctor with free-text school
        p = _sess()
        email = _unique_email("proctor2")
        r = p.post(f"{API}/auth/register/proctor", json={
            "school_name": "SMA Bebas", "name": "TEST PIC2", "email": email,
            "password": "x123456", "phone": "081"
        }, timeout=10)
        uid = r.json()["id"]
        created_test_user_ids.append(uid)

        # Admin links school + approves in one PUT
        r = admin_sess.put(f"{API}/admin/users/{uid}",
                           json={"school_id": SCHOOL_NUSANTARA, "status": "approved"}, timeout=10)
        assert r.status_code == 200

        # Verify persisted
        users = admin_sess.get(f"{API}/admin/users", timeout=10).json()
        found = next(u for u in users if u["id"] == uid)
        assert found["school_id"] == SCHOOL_NUSANTARA
        assert found["status"] == "approved"

        # Approved proctor can access dashboard & only sees SMA Nusantara 1 students
        s2 = _sess()
        _login(s2, {"email": email, "password": "x123456"})
        r = s2.get(f"{API}/proctor/dashboard", timeout=10)
        assert r.status_code == 200
        dash = r.json()
        assert dash["school"]["id"] == SCHOOL_NUSANTARA
        # Nusantara school has multiple demo students
        assert dash["total_students"] >= 5

        # /proctor/students should only return Nusantara students
        r = s2.get(f"{API}/proctor/students", timeout=10)
        assert r.status_code == 200
        stlist = r.json()
        assert len(stlist) >= 5
        for st in stlist:
            assert st.get("school_id") == SCHOOL_NUSANTARA

        # /proctor/trainings returns list with course info
        r = s2.get(f"{API}/proctor/trainings", timeout=10)
        assert r.status_code == 200
        trainings = r.json()
        assert isinstance(trainings, list)
        assert len(trainings) >= 1
        for t in trainings:
            assert "course_id" in t and "title" in t and "participants" in t and "students" in t
            assert isinstance(t["students"], list)
            assert t["participants"] == len(t["students"])

    def test_invalid_status_rejected(self, admin_sess):
        # Should 400 on invalid status
        # Reuse any created user
        assert created_test_user_ids
        uid = created_test_user_ids[0]
        r = admin_sess.put(f"{API}/admin/users/{uid}", json={"status": "banned"}, timeout=10)
        assert r.status_code == 400


# ---------- 4. Proctor isolation: pending proctor with no school gets [] not global ----------
class TestProctorIsolation:
    def test_pending_proctor_school_none_blocked(self):
        p = _sess()
        email = _unique_email("iso")
        r = p.post(f"{API}/auth/register/proctor", json={
            "school_name": "SMA Iso", "name": "TEST", "email": email, "password": "x123456", "phone": "081"
        }, timeout=10)
        uid = r.json()["id"]
        created_test_user_ids.append(uid)
        # Not approved -> 403
        r = p.get(f"{API}/proctor/students", timeout=10)
        assert r.status_code == 403

    def test_approved_proctor_no_school_returns_empty(self, admin_sess):
        # Approve without linking a school -> should see empty list (school_id None guard)
        p = _sess()
        email = _unique_email("noSchool")
        r = p.post(f"{API}/auth/register/proctor", json={
            "school_name": "SMA X", "name": "TEST", "email": email, "password": "x123456", "phone": "081"
        }, timeout=10)
        uid = r.json()["id"]
        created_test_user_ids.append(uid)
        # Approve WITHOUT school_id
        r = admin_sess.put(f"{API}/admin/users/{uid}", json={"status": "approved"}, timeout=10)
        assert r.status_code == 200

        s2 = _sess()
        _login(s2, {"email": email, "password": "x123456"})
        r = s2.get(f"{API}/proctor/students", timeout=10)
        assert r.status_code == 200
        assert r.json() == []
        r = s2.get(f"{API}/proctor/trainings", timeout=10)
        assert r.status_code == 200
        assert r.json() == []


# ---------- 5. Regression: demo accounts still work without verification ----------
class TestDemoAccountsRegression:
    def test_admin_login_and_stats(self):
        s = _sess()
        _login(s, ADMIN)
        me = s.get(f"{API}/auth/me").json()
        assert me["role"] == "admin"
        # status should be approved via startup migration
        assert me.get("status", "approved") == "approved"
        r = s.get(f"{API}/admin/stats")
        assert r.status_code == 200

    def test_demo_student_portal(self):
        s = _sess()
        _login(s, DEMO_STUDENT)
        me = s.get(f"{API}/auth/me").json()
        assert me["status"] == "approved"
        r = s.get(f"{API}/student/dashboard")
        assert r.status_code == 200

    def test_demo_proctor_isolated_to_nusantara(self):
        s = _sess()
        _login(s, DEMO_PROCTOR)
        me = s.get(f"{API}/auth/me").json()
        assert me["status"] == "approved"
        assert me["school_id"] == SCHOOL_NUSANTARA
        r = s.get(f"{API}/proctor/students")
        assert r.status_code == 200
        for st in r.json():
            assert st["school_id"] == SCHOOL_NUSANTARA

    def test_demo_tutor(self):
        s = _sess()
        _login(s, DEMO_TUTOR)
        me = s.get(f"{API}/auth/me").json()
        assert me["role"] == "tutor"
        assert me["status"] == "approved"


# ---------- 6. Admin-created user is auto-approved ----------
class TestAdminCreatedUser:
    def test_admin_create_user_auto_approved(self, admin_sess):
        email = _unique_email("adminCreated")
        r = admin_sess.post(f"{API}/admin/users", json={
            "name": "TEST AdminCreated", "email": email, "password": "x123456",
            "role": "student", "school_id": SCHOOL_NUSANTARA
        }, timeout=10)
        assert r.status_code == 200
        uid = r.json()["id"]
        created_test_user_ids.append(uid)
        # Login and access portal
        s = _sess()
        _login(s, {"email": email, "password": "x123456"})
        me = s.get(f"{API}/auth/me").json()
        assert me["status"] == "approved"
        r = s.get(f"{API}/student/dashboard")
        assert r.status_code == 200
