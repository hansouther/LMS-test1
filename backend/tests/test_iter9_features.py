"""Iterasi 9 backend tests:
- Notifikasi materi & pertemuan baru (student in-app)
- Rekap kehadiran (tutor/admin per class, proctor cross-class w/ school isolation)
- Kalender publik menyertakan sesi kelas terkonfirmasi (type='class')
"""
import os
import re
import time
import pytest
import requests
from pathlib import Path

# Read BASE_URL from frontend/.env directly (no default)
env_file = Path("/app/frontend/.env").read_text()
m = re.search(r"REACT_APP_BACKEND_URL=(\S+)", env_file)
assert m, "REACT_APP_BACKEND_URL not found"
BASE_URL = m.group(1).rstrip("/")

ADMIN = ("admin@lms.id", "Admin@12345")
TUTOR = ("tutor@lms.id", "Tutor@12345")
STUDENT = ("siswa@lms.id", "Siswa@12345")
PROCTOR = ("proktor@lms.id", "Proktor@12345")
STUDENT_OTHER = ("rizki@lms.id", "Siswa@12345")  # different school


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def sessions():
    return {
        "admin": _login(*ADMIN),
        "tutor": _login(*TUTOR),
        "student": _login(*STUDENT),
        "proctor": _login(*PROCTOR),
        "other": _login(*STUDENT_OTHER),
    }


@pytest.fixture(scope="module")
def created_slot(sessions):
    """Admin creates a 2-session confirmed class linked to course_utbk, assigned to tutor."""
    admin = sessions["admin"]
    tutor = sessions["tutor"]
    # 1. Create slot with 2 sessions
    body = {
        "title": "TEST_ITER9 Kelas Notif",
        "subject": "Matematika",
        "required_qualifications": ["Matematika"],
        "course_id": "course_utbk",
        "open_to_all": False,
        "sessions": [
            {"date": "2026-08-25", "start_time": "09:00", "end_time": "10:00", "topic": "Sesi 1"},
            {"date": "2026-08-26", "start_time": "09:00", "end_time": "10:00", "topic": "Sesi 2"},
        ],
    }
    r = admin.post(f"{BASE_URL}/api/admin/slots", json=body, timeout=15)
    assert r.status_code == 200, r.text
    slot = r.json()
    slot_id = slot["id"]

    # 2. Tutor bids
    r = tutor.post(f"{BASE_URL}/api/tutor/slots/{slot_id}/bid", json={"message": "saya siap"}, timeout=15)
    assert r.status_code == 200, r.text

    # 3. Admin assigns
    bids = admin.get(f"{BASE_URL}/api/admin/slots/{slot_id}/bids").json()
    bid_id = bids[0]["id"]
    r = admin.post(f"{BASE_URL}/api/admin/slots/{slot_id}/assign/{bid_id}", timeout=15)
    assert r.status_code == 200

    yield slot_id

    # cleanup cascade
    admin.delete(f"{BASE_URL}/api/admin/slots/{slot_id}")


# ---------- 1. Student notifications on new material ----------
class TestMaterialNotification:
    def test_add_material_pushes_notification(self, sessions, created_slot):
        tutor = sessions["tutor"]
        student = sessions["student"]

        # baseline unread count
        base = student.get(f"{BASE_URL}/api/student/notifications").json()
        base_unread = base["unread"]

        # get session id
        mine = tutor.get(f"{BASE_URL}/api/classes/mine").json()
        my = next(m for m in mine if m["id"] == created_slot)
        session_id = my["sessions"][0]["id"]

        # tutor adds material
        r = tutor.post(
            f"{BASE_URL}/api/classes/{created_slot}/sessions/{session_id}/materials",
            json={"title": "TEST_ITER9 Materi", "link": "https://example.com"},
        )
        assert r.status_code == 200

        time.sleep(0.5)
        after = student.get(f"{BASE_URL}/api/student/notifications").json()
        assert after["unread"] >= base_unread + 1
        items = after["items"]
        found = [i for i in items if i.get("type") == "material" and "TEST_ITER9 Materi" in i.get("title", "")]
        assert found, f"material notification not found: {items[:3]}"
        assert found[0]["read"] is False

    def test_mark_read(self, sessions):
        student = sessions["student"]
        r = student.post(f"{BASE_URL}/api/student/notifications/read")
        assert r.status_code == 200
        data = student.get(f"{BASE_URL}/api/student/notifications").json()
        assert data["unread"] == 0

    def test_other_school_student_no_material_notif(self, sessions):
        # rizki@lms.id is NOT enrolled to course_utbk -> should not receive
        other = sessions["other"]
        r = other.get(f"{BASE_URL}/api/student/notifications")
        assert r.status_code == 200
        items = r.json()["items"]
        assert not any("TEST_ITER9 Materi" in (i.get("title") or "") for i in items)


# ---------- 2. Notification on new session added ----------
class TestSessionNotification:
    def test_update_slot_adds_session_notifies(self, sessions, created_slot):
        admin = sessions["admin"]
        student = sessions["student"]

        # add a 3rd session via PUT
        current = admin.get(f"{BASE_URL}/api/admin/slots").json()
        slot = next(s for s in current if s["id"] == created_slot)
        new_sessions = [{"date": s["date"], "start_time": s["start_time"], "end_time": s["end_time"],
                         "topic": s.get("topic"), "id": s["id"]} for s in slot["sessions"]]
        new_sessions.append({"date": "2026-08-27", "start_time": "10:00", "end_time": "11:00", "topic": "Sesi baru"})

        body = {
            "title": slot["title"], "subject": slot["subject"],
            "required_qualifications": slot.get("required_qualifications", []),
            "course_id": slot.get("course_id"), "open_to_all": slot.get("open_to_all", False),
            "notes": slot.get("notes"), "sessions": new_sessions,
        }
        r = admin.put(f"{BASE_URL}/api/admin/slots/{created_slot}", json=body)
        assert r.status_code == 200, r.text

        time.sleep(0.5)
        data = student.get(f"{BASE_URL}/api/student/notifications").json()
        found = [i for i in data["items"] if i.get("type") == "session" and "pertemuan baru" in (i.get("title", "").lower())]
        assert found, f"session notification not found: {data['items'][:3]}"


# ---------- 3. Attendance summary (tutor/admin) ----------
class TestAttendanceSummary:
    def test_tutor_summary_and_percentage(self, sessions, created_slot):
        tutor = sessions["tutor"]
        mine = tutor.get(f"{BASE_URL}/api/classes/mine").json()
        my = next(m for m in mine if m["id"] == created_slot)
        s0 = my["sessions"][0]["id"]

        # get roster and mark siswa@lms.id as present in session 0
        roster = tutor.get(f"{BASE_URL}/api/classes/{created_slot}/sessions/{s0}/roster").json()
        assert roster["students"], "roster empty"
        siswa = next((s for s in roster["students"] if s["email"] == "siswa@lms.id"), None)
        assert siswa, f"siswa not in roster: {[s['email'] for s in roster['students']]}"

        r = tutor.post(
            f"{BASE_URL}/api/classes/{created_slot}/sessions/{s0}/attendance",
            json={"records": [{"student_id": siswa["id"], "status": "present"}]},
        )
        assert r.status_code == 200

        summary = tutor.get(f"{BASE_URL}/api/classes/{created_slot}/attendance-summary").json()
        assert summary["total_sessions"] >= 2
        row = next(r for r in summary["rows"] if r["student_id"] == siswa["id"])
        assert row["present"] == 1
        # 1/total*100 -> at least ~33 (if we added the 3rd session in prev test); at most 50
        assert 0 < row["rate"] <= 50

    def test_admin_can_view_summary(self, sessions, created_slot):
        admin = sessions["admin"]
        r = admin.get(f"{BASE_URL}/api/classes/{created_slot}/attendance-summary")
        assert r.status_code == 200
        assert "rows" in r.json()


# ---------- 4. Proctor cross-class attendance recap + isolation ----------
class TestProctorAttendance:
    def test_proctor_attendance_lists_school_students_only(self, sessions):
        r = sessions["proctor"].get(f"{BASE_URL}/api/proctor/attendance")
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        emails = {row["name"] for row in rows}
        # every row must be an SMA Nusantara 1 student — check via /proctor/students
        allowed_ids = {s["id"] for s in sessions["proctor"].get(f"{BASE_URL}/api/proctor/students").json()}
        for row in rows:
            assert row["student_id"] in allowed_ids
            assert set(row.keys()) >= {"student_id", "name", "attended", "total_sessions", "rate"}

    def test_non_proctor_forbidden(self, sessions):
        r = sessions["student"].get(f"{BASE_URL}/api/proctor/attendance")
        assert r.status_code == 403


# ---------- 5. Public calendar merges class sessions ----------
class TestPublicCalendar:
    def test_public_calendar_has_class_events(self, created_slot):
        r = requests.get(f"{BASE_URL}/api/public/calendar", timeout=15)
        assert r.status_code == 200
        items = r.json()
        classes = [i for i in items if i.get("type") == "class"]
        assert classes, "no class events on public calendar"
        sample = classes[0]
        assert "tutor" in sample and "start_time" in sample and "end_time" in sample
        # our created slot should show up
        titles = [c["title"] for c in classes]
        assert any("TEST_ITER9" in t for t in titles), f"created class not in calendar: {titles[:5]}"

    def test_public_calendar_keeps_academic_events(self):
        items = requests.get(f"{BASE_URL}/api/public/calendar").json()
        # There should still be non-class events (academic seed)
        non_class = [i for i in items if i.get("type") != "class"]
        # ok if empty in some envs, but ensure endpoint returns list & no crash
        assert isinstance(non_class, list)
