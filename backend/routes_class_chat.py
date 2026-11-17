from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends

from database import db
from utils import new_id, now_iso
from security import require_roles
from routes_chat import MessageBody, _clean
import notifications

router = APIRouter(prefix="/api/class-chat", tags=["class-chat"])
member_roles = require_roles("student", "tutor", "admin")


async def _student_course_ids(student_id: str) -> list:
    rows = await db.enrollments.find({"student_id": student_id}, {"_id": 0, "course_id": 1}).to_list(500)
    return [r["course_id"] for r in rows]


async def _my_slots(user: dict) -> list:
    q = {"status": "confirmed"}
    if user["role"] == "tutor":
        q["tutor_id"] = user["id"]
    elif user["role"] == "student":
        q["$or"] = [{"course_id": {"$in": await _student_course_ids(user["id"])}}, {"open_to_all": True}]
    return await db.teaching_slots.find(q, {"_id": 0, "id": 1, "title": 1}).to_list(500)


async def _class_for(slot_id: str, user: dict) -> dict:
    slot = await db.teaching_slots.find_one({"id": slot_id, "status": "confirmed"}, {"_id": 0})
    if not slot:
        raise HTTPException(status_code=404, detail="Kelas tidak ditemukan")
    role = user["role"]
    if role == "tutor" and slot.get("tutor_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Anda bukan tentor kelas ini")
    if role == "student" and not (slot.get("open_to_all") or slot.get("course_id") in await _student_course_ids(user["id"])):
        raise HTTPException(status_code=403, detail="Anda bukan anggota kelas ini")
    return slot


async def _mark_read(slot_id: str, user_id: str, at: str):
    await db.class_chat_reads.update_one({"slot_id": slot_id, "user_id": user_id},
                                         {"$set": {"slot_id": slot_id, "user_id": user_id, "last_read_at": at}}, upsert=True)


@router.get("/unread")
async def unread(user: dict = Depends(member_roles)):
    slots = await _my_slots(user)
    reads = {r["slot_id"]: r["last_read_at"] for r in await db.class_chat_reads.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)}
    out = {}
    for s in slots:
        q = {"slot_id": s["id"], "sender_id": {"$ne": user["id"]}, "deleted": {"$ne": True}}
        if reads.get(s["id"]):
            q["created_at"] = {"$gt": reads[s["id"]]}
        n = await db.class_chat_messages.count_documents(q)
        if n:
            out[s["id"]] = n
    return {"by_class": out, "total": sum(out.values())}


async def _members(slot: dict):
    tutor = await db.users.find_one({"id": slot.get("tutor_id")}, {"_id": 0, "id": 1, "name": 1, "picture": 1})
    sq = {"role": "student", "status": "approved"}
    if not slot.get("open_to_all"):
        ids = [e["student_id"] for e in await db.enrollments.find({"course_id": slot.get("course_id")}, {"_id": 0, "student_id": 1}).to_list(2000)]
        sq["id"] = {"$in": ids}
    students = await db.users.find(sq, {"_id": 0, "id": 1, "name": 1, "picture": 1}).sort("name", 1).to_list(500)
    return tutor, students


class ClassMessageBody(MessageBody):
    mentions: List[str] = []  # user id, atau "all" (khusus tentor/admin) untuk menyebut semua anggota


async def _notify_mentions(slot: dict, user: dict, msg: dict, requested: List[str]):
    tutor, students = await _members(slot)
    members = {m["id"]: m for m in ([tutor] if tutor else []) + students}
    everyone = "all" in requested and user["role"] in ("tutor", "admin")
    targets = [uid for uid in (members if everyone else dict.fromkeys(requested)) if uid in members and uid != user["id"]]
    msg["mentions"] = [{"id": uid, "name": members[uid]["name"]} for uid in targets if not everyone]
    msg["mention_all"] = everyone
    if not targets:
        return
    preview = (msg["text"] or "[gambar]")[:140]
    for uid in targets:
        base = "/tutor/classes" if members[uid] is tutor else "/student/schedule"
        await notifications.push([uid], "class_mention", f"{user.get('name')} menyebutmu di Chat Kelas {slot.get('title')}",
                                 preview, link=f"{base}?chat={slot['id']}")


@router.get("/{slot_id}/info")
async def info(slot_id: str, user: dict = Depends(member_roles)):
    slot = await _class_for(slot_id, user)
    tutor, students = await _members(slot)
    return {"id": slot["id"], "title": slot.get("title"), "subject": slot.get("subject"),
            "tutor": tutor, "students": students, "member_count": len(students) + (1 if tutor else 0)}


@router.get("/{slot_id}/messages")
async def messages(slot_id: str, after: Optional[str] = None, user: dict = Depends(member_roles)):
    await _class_for(slot_id, user)
    q = {"slot_id": slot_id, "deleted": {"$ne": True}}
    if after:
        q["created_at"] = {"$gt": after}
    items = (await db.class_chat_messages.find(q, {"_id": 0}).sort("created_at", -1).to_list(200))[::-1]
    if items:
        await _mark_read(slot_id, user["id"], items[-1]["created_at"])
    if after:
        gone = await db.class_chat_messages.find({"slot_id": slot_id, "deleted": True, "deleted_at": {"$gt": after}},
                                                 {"_id": 0, "id": 1}).to_list(200)
        items += [{"id": g["id"], "deleted": True} for g in gone]
    return items


@router.post("/{slot_id}/messages")
async def send(slot_id: str, body: ClassMessageBody, user: dict = Depends(member_roles)):
    slot = await _class_for(slot_id, user)
    text, img = _clean(body)
    msg = {"id": new_id(), "slot_id": slot_id, "sender_id": user["id"], "sender_role": user["role"],
           "sender_name": user.get("name"), "sender_picture": user.get("picture"),
           "text": text, "image_url": img, "created_at": now_iso(), "mentions": [], "mention_all": False}
    if body.mentions:
        await _notify_mentions(slot, user, msg, body.mentions[:50])
    await db.class_chat_messages.insert_one(msg)
    await _mark_read(slot_id, user["id"], msg["created_at"])
    msg.pop("_id", None)
    return msg


@router.delete("/{slot_id}/messages/{message_id}")
async def delete_message(slot_id: str, message_id: str, user: dict = Depends(member_roles)):
    await _class_for(slot_id, user)
    msg = await db.class_chat_messages.find_one({"id": message_id, "slot_id": slot_id}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Pesan tidak ditemukan")
    if user["role"] == "student" and msg["sender_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Anda hanya bisa menghapus pesan sendiri")
    await db.class_chat_messages.update_one({"id": message_id}, {"$set": {"deleted": True, "deleted_by": user["id"], "deleted_at": now_iso()}})
    return {"ok": True}
