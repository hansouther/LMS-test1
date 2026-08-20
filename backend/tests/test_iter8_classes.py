"""Iterasi 8 — Kelas multi-sesi + materi per pertemuan + presensi per pertemuan"""
import os
import pytest
import requests
from pathlib import Path

def _load_base():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if v:
        return v.rstrip("/")
    env = Path("/app/frontend/.env").read_text()
    for line in env.splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not set")

BASE_URL = _load_base()

ADMIN = ("admin@lms.id", "Admin@12345")
TUTOR = ("tutor@lms.id", "Tutor@12345")
STUDENT = ("siswa@lms.id", "Siswa@12345")
OTHER_STUDENT = ("rizki@lms.id", "Siswa@12345")  # school 2, not in course_utbk


def _client(creds):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": creds[0], "password": creds[1]})
    assert r.status_code == 200, f"login failed {creds[0]}: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def admin():
    return _client(ADMIN)


@pytest.fixture(scope="module")
def tutor():
    return _client(TUTOR)


@pytest.fixture(scope="module")
def student():
    return _client(STUDENT)


@pytest.fixture(scope="module")
def other_student():
    return _client(OTHER_STUDENT)


@pytest.fixture(scope="module")
def created(admin, tutor):
    """Create a multi-session slot, tutor bids, admin assigns. Returns slot dict."""
    payload = {
        "title": "TEST_Kelas Iter8 Multi Sesi",
        "subject": "Matematika",
        "required_qualifications": ["Matematika"],
        "course_id": "course_utbk",
        "open_to_all": False,
        "notes": "auto test",
        "sessions": [
            {"date": "2026-02-02", "start_time": "09:00", "end_time": "10:30", "topic": "Sesi 1"},
            {"date": "2026-02-09", "start_time": "09:00", "end_time": "10:30", "topic": "Sesi 2"},
            {"date": "2026-02-16", "start_time": "09:00", "end_time": "10:30", "topic": "Sesi 3"},
        ],
    }
    r = admin.post(f"{BASE_URL}/api/admin/slots", json=payload)
    assert r.status_code == 200, r.text
    slot = r.json()
    assert len(slot["sessions"]) == 3
    slot_id = slot["id"]

    # Tutor bids
    rb = tutor.post(f"{BASE_URL}/api/tutor/slots/{slot_id}/bid", json={"note": "siap"})
    assert rb.status_code == 200, rb.text

    # Admin views bids and assigns
    rlb = admin.get(f"{BASE_URL}/api/admin/slots/{slot_id}/bids")
    assert rlb.status_code == 200
    bids = rlb.json()
    assert len(bids) >= 1
    bid_id = bids[0]["id"]
    ra = admin.post(f"{BASE_URL}/api/admin/slots/{slot_id}/assign/{bid_id}")
    assert ra.status_code == 200, ra.text

    yield {"slot_id": slot_id, "sessions": slot["sessions"]}

    # Teardown
    admin.delete(f"{BASE_URL}/api/admin/slots/{slot_id}")


class TestSlotValidation:
    def test_no_sessions_rejected(self, admin):
        r = admin.post(f"{BASE_URL}/api/admin/slots", json={
            "title": "TEST_bad", "subject": "Matematika", "sessions": [],
        })
        assert r.status_code == 400


class TestClassesMine:
    def test_tutor_sees_only_own(self, tutor, created):
        r = tutor.get(f"{BASE_URL}/api/classes/mine")
        assert r.status_code == 200
        ids = [s["id"] for s in r.json()]
        assert created["slot_id"] in ids
        mine = next(s for s in r.json() if s["id"] == created["slot_id"])
        assert len(mine["sessions"]) == 3
        assert mine["course_title"]

    def test_admin_sees_all_confirmed(self, admin, created):
        r = admin.get(f"{BASE_URL}/api/classes/mine")
        assert r.status_code == 200
        ids = [s["id"] for s in r.json()]
        assert created["slot_id"] in ids

    def test_legacy_slots_have_sessions(self, admin):
        r = admin.get(f"{BASE_URL}/api/classes/mine")
        assert r.status_code == 200
        for s in r.json():
            assert len(s.get("sessions", [])) >= 1


class TestMaterials:
    def test_tutor_add_material_per_session(self, tutor, created):
        sid = created["sessions"][0]["id"]
        r = tutor.post(
            f"{BASE_URL}/api/classes/{created['slot_id']}/sessions/{sid}/materials",
            json={"title": "TEST_Materi Sesi 1", "description": "desc", "link": "https://example.com"},
        )
        assert r.status_code == 200, r.text
        m = r.json()
        assert m["session_id"] == sid
        assert m["creator_role"] == "tutor"

    def test_admin_add_material(self, admin, created):
        sid = created["sessions"][1]["id"]
        r = admin.post(
            f"{BASE_URL}/api/classes/{created['slot_id']}/sessions/{sid}/materials",
            json={"title": "TEST_Materi Admin Sesi 2", "link": "https://example.com/2"},
        )
        assert r.status_code == 200, r.text
        assert r.json()["creator_role"] == "admin"

    def test_material_invalid_session(self, tutor, created):
        r = tutor.post(
            f"{BASE_URL}/api/classes/{created['slot_id']}/sessions/nonexistent/materials",
            json={"title": "X"},
        )
        assert r.status_code == 404

    def test_list_materials(self, tutor, created):
        r = tutor.get(f"{BASE_URL}/api/classes/{created['slot_id']}/materials")
        assert r.status_code == 200
        assert len(r.json()) >= 2


class TestAttendance:
    def test_mark_and_persist_per_session(self, tutor, created, student):
        # Get student id via login
        me = student.get(f"{BASE_URL}/api/auth/me").json()
        sid1 = created["sessions"][0]["id"]
        sid2 = created["sessions"][1]["id"]
        # Session 1 - present
        r = tutor.post(
            f"{BASE_URL}/api/classes/{created['slot_id']}/sessions/{sid1}/attendance",
            json={"records": [{"student_id": me["id"], "status": "present"}]},
        )
        assert r.status_code == 200, r.text
        # Session 2 - absent
        r = tutor.post(
            f"{BASE_URL}/api/classes/{created['slot_id']}/sessions/{sid2}/attendance",
            json={"records": [{"student_id": me["id"], "status": "absent"}]},
        )
        assert r.status_code == 200
        # Verify roster shows correct per session
        r1 = tutor.get(f"{BASE_URL}/api/classes/{created['slot_id']}/sessions/{sid1}/roster").json()
        st1 = next(s for s in r1["students"] if s["id"] == me["id"])
        assert st1["attendance_status"] == "present"
        r2 = tutor.get(f"{BASE_URL}/api/classes/{created['slot_id']}/sessions/{sid2}/roster").json()
        st2 = next(s for s in r2["students"] if s["id"] == me["id"])
        assert st2["attendance_status"] == "absent"


class TestStudentView:
    def test_schedule_shows_class(self, student, created):
        r = student.get(f"{BASE_URL}/api/student/schedule")
        assert r.status_code == 200
        found = next((s for s in r.json() if s["id"] == created["slot_id"]), None)
        assert found is not None
        assert len(found["sessions"]) == 3
        assert found["material_count"] >= 2

    def test_class_detail(self, student, created):
        r = student.get(f"{BASE_URL}/api/student/classes/{created['slot_id']}")
        assert r.status_code == 200
        data = r.json()
        assert len(data["slot"]["sessions"]) == 3
        assert len(data["materials"]) >= 2
        sid1 = created["sessions"][0]["id"]
        assert data["my_attendance"].get(sid1) == "present"

    def test_unauthorized_student_403(self, other_student, created):
        r = other_student.get(f"{BASE_URL}/api/student/classes/{created['slot_id']}")
        assert r.status_code == 403


class TestCleanupMaterial:
    def test_delete_material(self, tutor, created):
        r = tutor.get(f"{BASE_URL}/api/classes/{created['slot_id']}/materials")
        mats = r.json()
        assert mats
        mid = mats[0]["id"]
        rd = tutor.delete(f"{BASE_URL}/api/classes/materials/{mid}")
        assert rd.status_code == 200
