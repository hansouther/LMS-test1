from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional

from database import db
from utils import new_id, now_iso, class_sessions
from security import require_roles

router = APIRouter(prefix="/api/classes", tags=["classes"])
manager = require_roles("tutor", "admin")


class MaterialBody(BaseModel):
    title: str
    description: Optional[str] = None
    link: Optional[str] = None
    file_url: Optional[str] = None
    file_name: Optional[str] = None


class AttendanceBody(BaseModel):
    records: List[dict]  # [{student_id, status, note}]


async def _get_class(slot_id: str, user: dict):
    slot = await db.teaching_slots.find_one({"id": slot_id}, {"_id": 0})
    if not slot:
        raise HTTPException(status_code=404, detail="Kelas tidak ditemukan")
    if user["role"] == "tutor" and slot.get("tutor_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Anda bukan tentor kelas ini")
    return slot


async def _course_students(course_id):
    if not course_id:
        return []
    enrolls = await db.enrollments.find({"course_id": course_id}, {"_id": 0}).to_list(1000)
    ids = [e["student_id"] for e in enrolls]
    return await db.users.find({"id": {"$in": ids}}, {"_id": 0, "password_hash": 0}).to_list(1000)


@router.get("/mine")
async def my_classes(user: dict = Depends(manager)):
    q = {"status": "confirmed"}
    if user["role"] == "tutor":
        q["tutor_id"] = user["id"]
    slots = await db.teaching_slots.find(q, {"_id": 0}).sort("date", 1).to_list(300)
    course_ids = list({s.get("course_id") for s in slots if s.get("course_id")})
    tutor_ids = list({s.get("tutor_id") for s in slots if s.get("tutor_id")})
    courses = await db.courses.find({"id": {"$in": course_ids}}, {"_id": 0, "id": 1, "title": 1}).to_list(300)
    tutors = await db.users.find({"id": {"$in": tutor_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(300)
    cmap = {c["id"]: c["title"] for c in courses}
    tmap = {t["id"]: t["name"] for t in tutors}
    for s in slots:
        s["sessions"] = class_sessions(s)
        s["course_title"] = cmap.get(s.get("course_id"), None)
        s["tutor_name"] = tmap.get(s.get("tutor_id"), "-")
        s["material_count"] = await db.class_materials.count_documents({"slot_id": s["id"]})
    return slots


@router.get("/{slot_id}/sessions/{session_id}/roster")
async def roster(slot_id: str, session_id: str, user: dict = Depends(manager)):
    slot = await _get_class(slot_id, user)
    students = await _course_students(slot.get("course_id"))
    att = await db.attendance.find({"slot_id": slot_id, "session_id": session_id}, {"_id": 0}).to_list(1000)
    amap = {a["student_id"]: a for a in att}
    favmap = {}
    if slot.get("course_id") and slot.get("tutor_id"):
        favs = await db.favorites.find({"course_id": slot["course_id"], "tutor_id": slot["tutor_id"]}, {"_id": 0}).to_list(1000)
        favmap = {f["student_id"]: f for f in favs}
    for s in students:
        rec = amap.get(s["id"])
        s["attendance_status"] = rec["status"] if rec else None
        fav = favmap.get(s["id"])
        s["is_favorite"] = bool(fav)
        s["favorite_note"] = fav.get("note") if fav else None
    return {"students": students}


@router.post("/{slot_id}/sessions/{session_id}/attendance")
async def mark_attendance(slot_id: str, session_id: str, body: AttendanceBody, user: dict = Depends(manager)):
    slot = await _get_class(slot_id, user)
    valid = {s["id"] for s in class_sessions(slot)}
    if session_id not in valid:
        raise HTTPException(status_code=404, detail="Pertemuan tidak ditemukan")
    for rec in body.records:
        await db.attendance.update_one(
            {"slot_id": slot_id, "session_id": session_id, "student_id": rec["student_id"]},
            {"$set": {
                "id": new_id(), "slot_id": slot_id, "session_id": session_id,
                "student_id": rec["student_id"], "status": rec.get("status", "present"),
                "note": rec.get("note"), "marked_by": user["id"], "marked_at": now_iso(),
            }},
            upsert=True,
        )
    return {"ok": True, "count": len(body.records)}


@router.get("/{slot_id}/materials")
async def list_materials(slot_id: str, user: dict = Depends(manager)):
    await _get_class(slot_id, user)
    return await db.class_materials.find({"slot_id": slot_id}, {"_id": 0}).sort("created_at", 1).to_list(500)


@router.post("/{slot_id}/sessions/{session_id}/materials")
async def add_material(slot_id: str, session_id: str, body: MaterialBody, user: dict = Depends(manager)):
    slot = await _get_class(slot_id, user)
    valid = {s["id"] for s in class_sessions(slot)}
    if session_id not in valid:
        raise HTTPException(status_code=404, detail="Pertemuan tidak ditemukan")
    doc = {
        "id": new_id(), "slot_id": slot_id, "session_id": session_id,
        "title": body.title, "description": body.description, "link": body.link,
        "file_url": body.file_url, "file_name": body.file_name,
        "created_by": user["id"], "creator_role": user["role"], "created_at": now_iso(),
    }
    await db.class_materials.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.delete("/materials/{material_id}")
async def delete_material(material_id: str, user: dict = Depends(manager)):
    m = await db.class_materials.find_one({"id": material_id})
    if not m:
        raise HTTPException(status_code=404, detail="Materi tidak ditemukan")
    if user["role"] == "tutor":
        slot = await db.teaching_slots.find_one({"id": m["slot_id"]}, {"_id": 0})
        if not slot or slot.get("tutor_id") != user["id"]:
            raise HTTPException(status_code=403, detail="Tidak diizinkan")
    await db.class_materials.delete_one({"id": material_id})
    return {"ok": True}
