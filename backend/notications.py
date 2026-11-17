from fastapi import APIRouter, Depends

from database import db
from security import require_roles
from utils import new_id, now_iso


async def push(user_ids, ntype, title, body, link=None):
    """Create in-app notifications for a list of users."""
    docs = [{
        "id": new_id(),
        "user_id": uid,
        "type": ntype,
        "title": title,
        "body": body,
        "link": link,
        "read": False,
        "created_at": now_iso(),
    } for uid in user_ids if uid]
    if docs:
        await db.notifications.insert_many(docs)
    return len(docs)


async def course_student_ids(course_id):
    if not course_id:
        return []
    enrolls = await db.enrollments.find({"course_id": course_id}, {"_id": 0, "student_id": 1}).to_list(2000)
    return [e["student_id"] for e in enrolls]


router = APIRouter(prefix="/api/notifications", tags=["notifications"])
any_user = require_roles("student", "tutor", "admin", "proctor")


@router.get("")
async def my_notifications(user: dict = Depends(any_user)):
    items = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    unread = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    return {"items": items, "unread": unread}


@router.post("/read")
async def mark_read(user: dict = Depends(any_user)):
    await db.notifications.update_many({"user_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}
