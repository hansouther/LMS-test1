"""Seed N approved student accounts + 1 isolated load-test Try Out (kind=exercise).

Usage:
    python seed_loadtest.py [N]          # default N=300

Creates:
    - users loadtest_1..N@lms.id  (password: Load@12345, status approved)
    - tryout  lt_tryout  (kind=exercise, published) with 5 single-choice questions

The Try Out uses kind=exercise so it allows repeat attempts (re-runnable load test)
and does NOT appear in the normal student Try Out list or any course.
Run cleanup_loadtest.py afterwards to remove everything.
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))

from motor.motor_asyncio import AsyncIOMotorClient
from security import hash_password

N = int(sys.argv[1]) if len(sys.argv) > 1 else 300
PASSWORD = "Load@12345"
SCHOOL_ID = "school_nusantara"
TRYOUT_ID = "lt_tryout"


async def main():
    c = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = c[os.environ["DB_NAME"]]

    # clean any previous run
    await db.users.delete_many({"email": {"$regex": "^loadtest_"}})
    pw = hash_password(PASSWORD)
    users = [{
        "id": f"loadtest_{i}",
        "name": f"Load Test {i}",
        "email": f"loadtest_{i}@lms.id",
        "password_hash": pw,
        "role": "student",
        "status": "approved",
        "school_id": SCHOOL_ID,
        "grade": "12",
        "goal": "load-test",
        "qualifications": [],
        "created_at": "2026-01-01T00:00:00+00:00",
    } for i in range(1, N + 1)]
    await db.users.insert_many(users)

    # isolated load-test tryout (exercise -> repeatable, hidden from normal lists)
    await db.tryouts.delete_many({"id": TRYOUT_ID})
    await db.questions.delete_many({"tryout_id": TRYOUT_ID})
    await db.tryouts.insert_one({
        "id": TRYOUT_ID, "title": "[LOADTEST] Try Out Simulasi", "subject": "Umum",
        "kind": "exercise", "published": True, "duration_minutes": 60,
        "description": "Khusus load test", "created_at": "2026-01-01T00:00:00+00:00",
    })
    qs = []
    for i in range(1, 6):
        qs.append({
            "id": f"lt_q{i}", "tryout_id": TRYOUT_ID, "order": i, "type": "single",
            "text": f"Soal load test #{i}: pilih A", "points": 20, "competency": "numerasi",
            "options": [{"id": "o1", "text": "A"}, {"id": "o2", "text": "B"},
                        {"id": "o3", "text": "C"}, {"id": "o4", "text": "D"}],
            "correct_answers": ["o1"],
        })
    await db.questions.insert_many(qs)

    print(f"Seeded {N} students (loadtest_1..{N}@lms.id / {PASSWORD})")
    print(f"Seeded tryout '{TRYOUT_ID}' with 5 questions")


if __name__ == "__main__":
    asyncio.run(main())
