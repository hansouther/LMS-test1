from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import List, Optional

from database import db
from utils import new_id, now_iso
from security import require_roles, hash_password

router = APIRouter(prefix="/api/admin", tags=["admin"])
admin_only = require_roles("admin")


# ---------- Models ----------
class NewsBody(BaseModel):
    title: str
    content: str
    category: str = "Pengumuman"
    published: bool = True


class CalendarBody(BaseModel):
    title: str
    description: Optional[str] = None
    date: str
    type: str = "academic"


class CourseBody(BaseModel):
    title: str
    description: str
    subject: str
    level: str = "Umum"
    price: int = 0
    thumbnail: Optional[str] = None
    active: bool = True


class SlotBody(BaseModel):
    title: str
    subject: str
    date: str
    start_time: str
    end_time: str
    required_qualifications: List[str] = []
    course_id: Optional[str] = None
    open_to_all: bool = False
    notes: Optional[str] = None


class TryoutBody(BaseModel):
    title: str
    description: Optional[str] = None
    subject: str
    duration_minutes: int = 60
    start_at: Optional[str] = None
    end_at: Optional[str] = None
    published: bool = False


class QuestionBody(BaseModel):
    type: str  # single | multiple | truefalse | essay
    text: str
    options: List[dict] = []
    correct_answers: List[str] = []
    points: int = 1
    order: int = 0


class BroadcastBody(BaseModel):
    title: str
    message: str
    priority: str = "normal"


class UserBody(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str  # tutor | proctor | student
    phone: Optional[str] = None
    school_id: Optional[str] = None
    qualifications: List[str] = []


class SchoolBody(BaseModel):
    name: str
    city: Optional[str] = None


# ---------- Dashboard ----------
@router.get("/stats")
async def stats(user: dict = Depends(admin_only)):
    return {
        "students": await db.users.count_documents({"role": "student"}),
        "tutors": await db.users.count_documents({"role": "tutor"}),
        "proctors": await db.users.count_documents({"role": "proctor"}),
        "courses": await db.courses.count_documents({}),
        "tryouts": await db.tryouts.count_documents({}),
        "open_slots": await db.teaching_slots.count_documents({"status": "open"}),
        "pending_partnerships": await db.partnerships.count_documents({"status": "new"}),
        "total_attempts": await db.attempts.count_documents({"status": "submitted"}),
    }


# ---------- News ----------
@router.get("/news")
async def list_news(user: dict = Depends(admin_only)):
    return await db.news.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


@router.post("/news")
async def create_news(body: NewsBody, user: dict = Depends(admin_only)):
    doc = {"id": new_id(), **body.model_dump(), "author": user["name"], "created_at": now_iso()}
    await db.news.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.put("/news/{item_id}")
async def update_news(item_id: str, body: NewsBody, user: dict = Depends(admin_only)):
    res = await db.news.update_one({"id": item_id}, {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Berita tidak ditemukan")
    return {"ok": True}


@router.delete("/news/{item_id}")
async def delete_news(item_id: str, user: dict = Depends(admin_only)):
    await db.news.delete_one({"id": item_id})
    return {"ok": True}


# ---------- Calendar ----------
@router.get("/calendar")
async def list_calendar(user: dict = Depends(admin_only)):
    return await db.calendar_events.find({}, {"_id": 0}).sort("date", 1).to_list(500)


@router.post("/calendar")
async def create_calendar(body: CalendarBody, user: dict = Depends(admin_only)):
    doc = {"id": new_id(), **body.model_dump(), "created_at": now_iso()}
    await db.calendar_events.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.delete("/calendar/{item_id}")
async def delete_calendar(item_id: str, user: dict = Depends(admin_only)):
    await db.calendar_events.delete_one({"id": item_id})
    return {"ok": True}


# ---------- Courses ----------
@router.get("/courses")
async def list_courses(user: dict = Depends(admin_only)):
    items = await db.courses.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for c in items:
        c["enrolled_count"] = await db.enrollments.count_documents({"course_id": c["id"]})
    return items


@router.post("/courses")
async def create_course(body: CourseBody, user: dict = Depends(admin_only)):
    doc = {"id": new_id(), **body.model_dump(), "created_at": now_iso()}
    await db.courses.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.put("/courses/{item_id}")
async def update_course(item_id: str, body: CourseBody, user: dict = Depends(admin_only)):
    res = await db.courses.update_one({"id": item_id}, {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Kursus tidak ditemukan")
    return {"ok": True}


@router.delete("/courses/{item_id}")
async def delete_course(item_id: str, user: dict = Depends(admin_only)):
    await db.courses.delete_one({"id": item_id})
    return {"ok": True}


# ---------- Partnerships ----------
@router.get("/partnerships")
async def list_partnerships(user: dict = Depends(admin_only)):
    return await db.partnerships.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


@router.put("/partnerships/{item_id}")
async def update_partnership(item_id: str, status: str, user: dict = Depends(admin_only)):
    await db.partnerships.update_one({"id": item_id}, {"$set": {"status": status}})
    return {"ok": True}


# ---------- Teaching Slots & Bidding ----------
@router.get("/slots")
async def list_slots(user: dict = Depends(admin_only)):
    slots = await db.teaching_slots.find({}, {"_id": 0}).sort("date", 1).to_list(300)
    for s in slots:
        s["bid_count"] = await db.bids.count_documents({"slot_id": s["id"]})
    return slots


@router.post("/slots")
async def create_slot(body: SlotBody, user: dict = Depends(admin_only)):
    doc = {
        "id": new_id(),
        **body.model_dump(),
        "status": "open",
        "tutor_id": None,
        "created_by": user["id"],
        "created_at": now_iso(),
    }
    await db.teaching_slots.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.delete("/slots/{slot_id}")
async def delete_slot(slot_id: str, user: dict = Depends(admin_only)):
    await db.teaching_slots.delete_one({"id": slot_id})
    await db.bids.delete_many({"slot_id": slot_id})
    return {"ok": True}


@router.get("/slots/{slot_id}/bids")
async def slot_bids(slot_id: str, user: dict = Depends(admin_only)):
    return await db.bids.find({"slot_id": slot_id}, {"_id": 0}).sort("created_at", 1).to_list(200)


@router.post("/slots/{slot_id}/assign/{bid_id}")
async def assign_slot(slot_id: str, bid_id: str, user: dict = Depends(admin_only)):
    bid = await db.bids.find_one({"id": bid_id, "slot_id": slot_id}, {"_id": 0})
    if not bid:
        raise HTTPException(status_code=404, detail="Bid tidak ditemukan")
    await db.teaching_slots.update_one(
        {"id": slot_id}, {"$set": {"status": "confirmed", "tutor_id": bid["tutor_id"]}}
    )
    await db.bids.update_one({"id": bid_id}, {"$set": {"status": "accepted"}})
    await db.bids.update_many(
        {"slot_id": slot_id, "id": {"$ne": bid_id}}, {"$set": {"status": "rejected"}}
    )
    return {"ok": True}


# ---------- Try Out & Questions ----------
@router.get("/tryouts")
async def list_tryouts(user: dict = Depends(admin_only)):
    items = await db.tryouts.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for t in items:
        t["question_count"] = await db.questions.count_documents({"tryout_id": t["id"]})
        t["attempt_count"] = await db.attempts.count_documents({"tryout_id": t["id"], "status": "submitted"})
    return items


@router.post("/tryouts")
async def create_tryout(body: TryoutBody, user: dict = Depends(admin_only)):
    doc = {"id": new_id(), **body.model_dump(), "created_by": user["id"], "created_at": now_iso()}
    await db.tryouts.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.put("/tryouts/{tryout_id}")
async def update_tryout(tryout_id: str, body: TryoutBody, user: dict = Depends(admin_only)):
    res = await db.tryouts.update_one({"id": tryout_id}, {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Try Out tidak ditemukan")
    return {"ok": True}


@router.delete("/tryouts/{tryout_id}")
async def delete_tryout(tryout_id: str, user: dict = Depends(admin_only)):
    await db.tryouts.delete_one({"id": tryout_id})
    await db.questions.delete_many({"tryout_id": tryout_id})
    return {"ok": True}


@router.get("/tryouts/{tryout_id}/questions")
async def list_questions(tryout_id: str, user: dict = Depends(admin_only)):
    return await db.questions.find({"tryout_id": tryout_id}, {"_id": 0}).sort("order", 1).to_list(300)


@router.post("/tryouts/{tryout_id}/questions")
async def create_question(tryout_id: str, body: QuestionBody, user: dict = Depends(admin_only)):
    if not await db.tryouts.find_one({"id": tryout_id}):
        raise HTTPException(status_code=404, detail="Try Out tidak ditemukan")
    count = await db.questions.count_documents({"tryout_id": tryout_id})
    doc = {"id": new_id(), "tryout_id": tryout_id, **body.model_dump()}
    if not doc.get("order"):
        doc["order"] = count + 1
    await db.questions.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.put("/questions/{question_id}")
async def update_question(question_id: str, body: QuestionBody, user: dict = Depends(admin_only)):
    res = await db.questions.update_one({"id": question_id}, {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Soal tidak ditemukan")
    return {"ok": True}


@router.delete("/questions/{question_id}")
async def delete_question(question_id: str, user: dict = Depends(admin_only)):
    await db.questions.delete_one({"id": question_id})
    return {"ok": True}


@router.get("/tryouts/{tryout_id}/results")
async def tryout_results(tryout_id: str, user: dict = Depends(admin_only)):
    attempts = await db.attempts.find(
        {"tryout_id": tryout_id, "status": "submitted"}, {"_id": 0, "per_question": 0}
    ).to_list(2000)
    sids = list({a["student_id"] for a in attempts})
    students = await db.users.find({"id": {"$in": sids}}, {"_id": 0, "id": 1, "name": 1, "email": 1}).to_list(2000)
    smap = {s["id"]: s for s in students}
    for a in attempts:
        a["student"] = smap.get(a["student_id"])
    return sorted(attempts, key=lambda a: a.get("percentage", 0), reverse=True)


# ---------- Broadcasts ----------
@router.get("/broadcasts")
async def list_broadcasts(user: dict = Depends(admin_only)):
    return await db.broadcasts.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


@router.post("/broadcasts")
async def create_broadcast(body: BroadcastBody, user: dict = Depends(admin_only)):
    doc = {"id": new_id(), **body.model_dump(), "author": user["name"], "created_at": now_iso()}
    await db.broadcasts.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.delete("/broadcasts/{item_id}")
async def delete_broadcast(item_id: str, user: dict = Depends(admin_only)):
    await db.broadcasts.delete_one({"id": item_id})
    return {"ok": True}


# ---------- Users & Schools ----------
@router.get("/users")
async def list_users(role: Optional[str] = None, user: dict = Depends(admin_only)):
    q = {"role": role} if role else {}
    items = await db.users.find(q, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)
    schools = await db.schools.find({}, {"_id": 0}).to_list(200)
    smap = {s["id"]: s["name"] for s in schools}
    for u in items:
        u["school_name"] = smap.get(u.get("school_id"))
    return items


@router.post("/users")
async def create_user(body: UserBody, user: dict = Depends(admin_only)):
    if body.role not in ("tutor", "proctor", "student"):
        raise HTTPException(status_code=400, detail="Peran tidak valid")
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    doc = {
        "id": new_id(),
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": body.role,
        "phone": body.phone,
        "school_id": body.school_id,
        "qualifications": body.qualifications,
        "picture": None,
        "auth_provider": "password",
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    return {"ok": True, "id": doc["id"]}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(admin_only)):
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Tidak dapat menghapus akun sendiri")
    await db.users.delete_one({"id": user_id})
    return {"ok": True}


@router.get("/schools")
async def list_schools(user: dict = Depends(admin_only)):
    items = await db.schools.find({}, {"_id": 0}).sort("name", 1).to_list(200)
    for s in items:
        s["student_count"] = await db.users.count_documents({"role": "student", "school_id": s["id"]})
    return items


@router.post("/schools")
async def create_school(body: SchoolBody, user: dict = Depends(admin_only)):
    doc = {"id": new_id(), **body.model_dump(), "created_at": now_iso()}
    await db.schools.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}
