"""Remove all load-test data (accounts, attempts, tryout, questions).

Usage:
    python cleanup_loadtest.py
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))
from motor.motor_asyncio import AsyncIOMotorClient

TRYOUT_ID = "lt_tryout"


async def main():
    c = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = c[os.environ["DB_NAME"]]
    sids = [u["id"] async for u in db.users.find({"email": {"$regex": "^loadtest_"}}, {"_id": 0, "id": 1})]
    a = await db.attempts.delete_many({"student_id": {"$in": sids}})
    a2 = await db.attempts.delete_many({"tryout_id": TRYOUT_ID})
    u = await db.users.delete_many({"email": {"$regex": "^loadtest_"}})
    await db.tryouts.delete_many({"id": TRYOUT_ID})
    await db.questions.delete_many({"tryout_id": TRYOUT_ID})
    print(f"Removed: {u.deleted_count} users, {a.deleted_count + a2.deleted_count} attempts, tryout {TRYOUT_ID}")


if __name__ == "__main__":
    asyncio.run(main())
