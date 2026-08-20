from database import db
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
