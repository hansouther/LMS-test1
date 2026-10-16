import uuid
import asyncio
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from typing import Optional

from database import db
from utils import new_id, now_iso
from security import require_roles
from storage import put_object, APP_NAME

router = APIRouter(prefix="/api", tags=["chat"])
student_only = require_roles("student")
admin_only = require_roles("admin")
chat_user = require_roles("student", "admin")

IMG_EXT = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "webp": "image/webp"}
MAX_TEXT = 2000


class MessageBody(BaseModel):
    text: Optional[str] = ""
    image_url: Optional[str] = None


def _clean(body: MessageBody):
    text = (body.text or "").strip()[:MAX_TEXT]
    img = body.image_url if body.image_url and body.image_url.startswith("/api/files/") else None
    if not text and not img:
        raise HTTPException(status_code=400, detail="Pesan kosong")
    return text, img


async def _messages(student_id: str, after: Optional[str]):
    q = {"thread_id": student_id}
    if after:
        q["created_at"] = {"$gt": after}
    items = await db.chat_messages.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items[::-1]


async def _post(student_id: str, sender: dict, text: str, img: Optional[str]) -> dict:
    msg = {"id": new_id(), "thread_id": student_id, "sender_id": sender["id"], "sender_role": sender["role"],
           "sender_name": sender.get("name"), "text": text, "image_url": img, "created_at": now_iso()}
    await db.chat_messages.insert_one(msg)
    inc = "unread_admin" if sender["role"] == "student" else "unread_student"
    await db.chat_threads.update_one(
        {"id": student_id},
        {"$set": {"id": student_id, "student_id": student_id, "last_text": text or "[Gambar]",
                  "last_role": sender["role"], "last_at": msg["created_at"]}, "$inc": {inc: 1}},
        upsert=True,
    )
    msg.pop("_id", None)
    return msg


@router.post("/chat/upload")
async def chat_upload(file: UploadFile = File(...), user: dict = Depends(chat_user)):
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else ""
    if ext not in IMG_EXT:
        raise HTTPException(status_code=400, detail="Format gambar harus PNG, JPG, atau WEBP")
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ukuran gambar maksimal 5 MB")
    path = f"{APP_NAME}/chat/{user['id']}/{uuid.uuid4().hex}.{ext}"
    try:
        result = await asyncio.to_thread(put_object, path, data, IMG_EXT[ext])
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gagal mengunggah gambar: {e}")
    await db.files.insert_one({
        "id": uuid.uuid4().hex, "storage_path": result["path"], "original_filename": file.filename,
        "content_type": IMG_EXT[ext], "size": len(data), "uploaded_by": user["id"],
        "is_deleted": False, "created_at": now_iso(),
    })
    return {"url": f"/api/files/{result['path']}"}


# ----- Siswa -----
@router.get("/chat/messages")
async def my_messages(after: Optional[str] = None, user: dict = Depends(student_only)):
    return await _messages(user["id"], after)


@router.post("/chat/messages")
async def send_my_message(body: MessageBody, user: dict = Depends(student_only)):
    text, img = _clean(body)
    return await _post(user["id"], user, text, img)


@router.get("/chat/unread")
async def my_unread(user: dict = Depends(student_only)):
    t = await db.chat_threads.find_one({"id": user["id"]}, {"_id": 0, "unread_student": 1})
    return {"count": (t or {}).get("unread_student", 0)}


@router.post("/chat/read")
async def my_read(user: dict = Depends(student_only)):
    await db.chat_threads.update_one({"id": user["id"]}, {"$set": {"unread_student": 0}})
    return {"ok": True}


# ----- Admin -----
@router.get("/admin/chat/unread")
async def admin_unread(user: dict = Depends(admin_only)):
    rows = await db.chat_threads.aggregate([{"$group": {"_id": None, "n": {"$sum": "$unread_admin"}}}]).to_list(1)
    return {"count": rows[0]["n"] if rows else 0}


@router.get("/admin/chat/threads")
async def admin_threads(user: dict = Depends(admin_only)):
    threads = await db.chat_threads.find({}, {"_id": 0}).sort("last_at", -1).to_list(500)
    sids = [t["student_id"] for t in threads]
    users = await db.users.find({"id": {"$in": sids}}, {"_id": 0, "id": 1, "name": 1, "email": 1, "grade": 1, "school_id": 1, "picture": 1}).to_list(500)
    umap = {u["id"]: u for u in users}
    smap = {s["id"]: s["name"] for s in await db.schools.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(500)}
    out = []
    for t in threads:
        u = umap.get(t["student_id"]) or {}
        out.append({**t, "student_name": u.get("name") or "(akun dihapus)", "student_email": u.get("email"),
                    "grade": u.get("grade"), "school_name": smap.get(u.get("school_id")), "picture": u.get("picture"),
                    "unread_admin": t.get("unread_admin", 0)})
    return out


@router.get("/admin/chat/threads/{student_id}/messages")
async def admin_thread_messages(student_id: str, after: Optional[str] = None, user: dict = Depends(admin_only)):
    await db.chat_threads.update_one({"id": student_id}, {"$set": {"unread_admin": 0}})
    return await _messages(student_id, after)


@router.post("/admin/chat/threads/{student_id}/messages")
async def admin_send(student_id: str, body: MessageBody, user: dict = Depends(admin_only)):
    if not await db.users.find_one({"id": student_id, "role": "student"}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Siswa tidak ditemukan")
    text, img = _clean(body)
    return await _post(student_id, user, text, img)
