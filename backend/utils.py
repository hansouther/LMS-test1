import uuid
from datetime import datetime, timezone


def new_id() -> str:
    return uuid.uuid4().hex


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def class_sessions(slot: dict) -> list:
    """Return a class's sessions, synthesizing one from legacy single-date slots."""
    sessions = slot.get("sessions")
    if sessions:
        return sessions
    if slot.get("date"):
        return [{
            "id": f"{slot['id']}__s1",
            "no": 1,
            "date": slot.get("date"),
            "start_time": slot.get("start_time"),
            "end_time": slot.get("end_time"),
            "topic": slot.get("notes"),
        }]
    return []

