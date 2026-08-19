from fastapi import APIRouter
from pydantic import BaseModel, EmailStr

from database import db
from utils import new_id, now_iso

router = APIRouter(prefix="/api/public", tags=["public"])


class PartnershipBody(BaseModel):
    org_name: str
    contact_name: str
    email: EmailStr
    phone: str
    org_type: str
    student_count: int
    message: str | None = None


@router.get("/news")
async def get_news():
    items = await db.news.find({"published": True}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return items


@router.get("/calendar")
async def get_calendar():
    items = await db.calendar_events.find({}, {"_id": 0}).sort("date", 1).to_list(200)
    return items


@router.get("/courses")
async def get_courses():
    items = await db.courses.find({"active": True}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return items


@router.get("/schools")
async def get_schools():
    items = await db.schools.find({}, {"_id": 0}).sort("name", 1).to_list(200)
    return items


@router.get("/stats")
async def public_stats():
    students = await db.users.count_documents({"role": "student"})
    tutors = await db.users.count_documents({"role": "tutor"})
    courses = await db.courses.count_documents({"active": True})
    schools = await db.schools.count_documents({})
    return {"students": students, "tutors": tutors, "courses": courses, "schools": schools}


@router.post("/partnerships")
async def submit_partnership(body: PartnershipBody):
    doc = {
        "id": new_id(),
        **body.model_dump(),
        "status": "new",
        "created_at": now_iso(),
    }
    await db.partnerships.insert_one(doc)
    return {"ok": True, "id": doc["id"]}
