from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List

from database import db
from utils import new_id, now_iso
from security import require_roles

router = APIRouter(prefix="/api/tutor", tags=["tutor"])
tutor_only = require_roles("tutor")


class BidBody(BaseModel):
    message: str | None = None


class MaterialBody(BaseModel):
    title: str
    description: str | None = None
    content: str | None = None
    file_url: str | None = None
    subject: str | None = None
    visibility: str = "public"  # public | private
    course_id: str | None = None


class AttendanceBody(BaseModel):
    slot_id: str
    records: List[dict]  # [{student_id, status, note}]


@router.get("/dashboard")
async def dashboard(user: dict = Depends(tutor_only)):
    tid = user["id"]
    open_slots = await db.teaching_slots.count_documents({"status": "open"})
    my_bids = await db.bids.count_documents({"tutor_id": tid})
    confirmed = await db.teaching_slots.count_documents({"tutor_id": tid, "status": "confirmed"})
    materials = await db.materials.count_documents({"tutor_id": tid})
    upcoming = await db.teaching_slots.find(
        {"tutor_id": tid, "status": "confirmed"}, {"_id": 0}
    ).sort("date", 1).to_list(5)
    return {
        "open_slots": open_slots,
        "my_bids": my_bids,
        "confirmed_classes": confirmed,
        "my_materials": materials,
        "upcoming": upcoming,
        "qualifications": user.get("qualifications", []),
    }


@router.get("/slots/open")
async def open_slots(user: dict = Depends(tutor_only)):
    slots = await db.teaching_slots.find({"status": "open"}, {"_id": 0}).sort("date", 1).to_list(100)
    my_bids = await db.bids.find({"tutor_id": user["id"]}, {"_id": 0}).to_list(200)
    bidmap = {b["slot_id"]: b for b in my_bids}
    quals = set(user.get("qualifications", []))
    for s in slots:
        req = set(s.get("required_qualifications", []))
        s["qualified"] = req.issubset(quals) if req else True
        b = bidmap.get(s["id"])
        s["my_bid_status"] = b["status"] if b else None
    return slots


@router.post("/slots/{slot_id}/bid")
async def place_bid(slot_id: str, body: BidBody, user: dict = Depends(tutor_only)):
    slot = await db.teaching_slots.find_one({"id": slot_id}, {"_id": 0})
    if not slot or slot["status"] != "open":
        raise HTTPException(status_code=400, detail="Slot tidak tersedia untuk bidding")
    req = set(slot.get("required_qualifications", []))
    quals = set(user.get("qualifications", []))
    if req and not req.issubset(quals):
        raise HTTPException(status_code=403, detail="Kualifikasi Anda tidak memenuhi syarat slot ini")
    if await db.bids.find_one({"slot_id": slot_id, "tutor_id": user["id"]}):
        raise HTTPException(status_code=400, detail="Anda sudah mengajukan bidding untuk slot ini")
    await db.bids.insert_one({
        "id": new_id(),
        "slot_id": slot_id,
        "tutor_id": user["id"],
        "tutor_name": user["name"],
        "message": body.message,
        "status": "pending",
        "created_at": now_iso(),
    })
    return {"ok": True}


@router.get("/bids")
async def my_bids(user: dict = Depends(tutor_only)):
    rows = await db.bids.find({"tutor_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    sids = [r["slot_id"] for r in rows]
    slots = await db.teaching_slots.find({"id": {"$in": sids}}, {"_id": 0}).to_list(200)
    smap = {s["id"]: s for s in slots}
    for r in rows:
        r["slot"] = smap.get(r["slot_id"])
    return rows


@router.get("/calendar")
async def calendar(user: dict = Depends(tutor_only)):
    slots = await db.teaching_slots.find(
        {"tutor_id": user["id"], "status": "confirmed"}, {"_id": 0}
    ).sort("date", 1).to_list(200)
    return slots


@router.get("/classes/{slot_id}/students")
async def class_students(slot_id: str, user: dict = Depends(tutor_only)):
    slot = await db.teaching_slots.find_one({"id": slot_id, "tutor_id": user["id"]}, {"_id": 0})
    if not slot:
        raise HTTPException(status_code=404, detail="Kelas tidak ditemukan")
    if slot.get("course_id"):
        enrolls = await db.enrollments.find({"course_id": slot["course_id"]}, {"_id": 0}).to_list(500)
        student_ids = [e["student_id"] for e in enrolls]
    else:
        student_ids = []
    students = await db.users.find({"id": {"$in": student_ids}}, {"_id": 0, "password_hash": 0}).to_list(500)
    existing = await db.attendance.find({"slot_id": slot_id}, {"_id": 0}).to_list(500)
    amap = {a["student_id"]: a for a in existing}
    for s in students:
        rec = amap.get(s["id"])
        s["attendance_status"] = rec["status"] if rec else None
    return {"slot": slot, "students": students}


@router.post("/attendance")
async def mark_attendance(body: AttendanceBody, user: dict = Depends(tutor_only)):
    slot = await db.teaching_slots.find_one({"id": body.slot_id, "tutor_id": user["id"]}, {"_id": 0})
    if not slot:
        raise HTTPException(status_code=404, detail="Kelas tidak ditemukan")
    for rec in body.records:
        await db.attendance.update_one(
            {"slot_id": body.slot_id, "student_id": rec["student_id"]},
            {"$set": {
                "id": new_id(),
                "slot_id": body.slot_id,
                "student_id": rec["student_id"],
                "tutor_id": user["id"],
                "status": rec.get("status", "present"),
                "note": rec.get("note"),
                "date": slot.get("date"),
                "marked_at": now_iso(),
            }},
            upsert=True,
        )
    return {"ok": True, "count": len(body.records)}


@router.get("/materials")
async def list_materials(user: dict = Depends(tutor_only)):
    items = await db.materials.find({"tutor_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@router.post("/materials")
async def create_material(body: MaterialBody, user: dict = Depends(tutor_only)):
    if body.visibility not in ("public", "private"):
        raise HTTPException(status_code=400, detail="Visibilitas tidak valid")
    doc = {
        "id": new_id(),
        "tutor_id": user["id"],
        **body.model_dump(),
        "created_at": now_iso(),
    }
    await db.materials.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.delete("/materials/{material_id}")
async def delete_material(material_id: str, user: dict = Depends(tutor_only)):
    res = await db.materials.delete_one({"id": material_id, "tutor_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Materi tidak ditemukan")
    return {"ok": True}


@router.get("/courses")
async def tutor_courses(user: dict = Depends(tutor_only)):
    return await db.courses.find({"active": True}, {"_id": 0}).to_list(100)
