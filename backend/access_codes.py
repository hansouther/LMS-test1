import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from database import db
from utils import new_id, now_iso
from security import require_roles

router = APIRouter(prefix="/api/student", tags=["access-codes"])
student_only = require_roles("student")

LABELS = {"course": "kursus", "tryout": "try out"}
TITLES = {"course": "Kursus", "tryout": "Try Out"}
COLLECTIONS = {"course": "courses", "tryout": "tryouts"}
MAX_FAILS = 10
FAIL_WINDOW_MIN = 15


def normalize(code: Optional[str]) -> Optional[str]:
    code = re.sub(r"\s+", "", (code or "")).upper()
    return code or None


def wrong_code_message(item_type: str) -> str:
    return (f"Kode yang kamu masukkan salah. Jika kamu penasaran untuk ikut kegiatan ini ({LABELS[item_type]}), "
            "harap hubungi gurumu untuk berhubungan langsung dengan kami di Binara LMS.")


def validate(code: Optional[str]) -> Optional[str]:
    code = normalize(code)
    if code and not re.fullmatch(r"[A-Z0-9-]{4,32}", code):
        raise HTTPException(status_code=400, detail="Kode akses harus 4–32 karakter (huruf, angka, atau tanda -)")
    return code


async def save_code(item_type: str, item_id: str, code: Optional[str]):
    code = validate(code)
    prev = await db.access_codes.find_one({"item_type": item_type, "item_id": item_id}, {"_id": 0})
    if prev and prev["code"] != code:
        await db.access_unlocks.delete_many({"item_type": item_type, "item_id": item_id})
    if code:
        await db.access_codes.update_one({"item_type": item_type, "item_id": item_id},
                                         {"$set": {"code": code, "updated_at": now_iso()}}, upsert=True)
    else:
        await db.access_codes.delete_one({"item_type": item_type, "item_id": item_id})
    await db[COLLECTIONS[item_type]].update_one({"id": item_id}, {"$set": {"code_locked": bool(code)}})


async def delete_code(item_type: str, item_id: str):
    await db.access_codes.delete_one({"item_type": item_type, "item_id": item_id})
    await db.access_unlocks.delete_many({"item_type": item_type, "item_id": item_id})


async def attach_codes(item_type: str, items: list):
    ids = [i["id"] for i in items]
    rows = await db.access_codes.find({"item_type": item_type, "item_id": {"$in": ids}}, {"_id": 0}).to_list(1000)
    cmap = {r["item_id"]: r["code"] for r in rows}
    for i in items:
        i["access_code"] = cmap.get(i["id"])


async def unlocked_ids(item_type: str, student_id: str) -> set:
    rows = await db.access_unlocks.find({"item_type": item_type, "student_id": student_id}, {"_id": 0, "item_id": 1}).to_list(1000)
    return {r["item_id"] for r in rows}


async def is_unlocked(item_type: str, item: dict, student_id: str) -> bool:
    if not item.get("code_locked"):
        return True
    return bool(await db.access_unlocks.find_one({"item_type": item_type, "item_id": item["id"], "student_id": student_id}))


async def require_unlocked(item_type: str, item: dict, student_id: str):
    if not await is_unlocked(item_type, item, student_id):
        raise HTTPException(status_code=403, detail=f"{TITLES[item_type]} ini terkunci. Masukkan kode akses dari gurumu untuk ikut.")


class UnlockBody(BaseModel):
    item_type: str
    item_id: str
    code: str


@router.post("/unlock")
async def unlock(body: UnlockBody, user: dict = Depends(student_only)):
    if body.item_type not in COLLECTIONS:
        raise HTTPException(status_code=400, detail="Jenis item tidak valid")
    item = await db[COLLECTIONS[body.item_type]].find_one({"id": body.item_id}, {"_id": 0, "id": 1, "code_locked": 1})
    if not item:
        raise HTTPException(status_code=404, detail="Item tidak ditemukan")
    if await is_unlocked(body.item_type, item, user["id"]):
        return {"ok": True}
    since = (datetime.now(timezone.utc) - timedelta(minutes=FAIL_WINDOW_MIN)).isoformat()
    fails = await db.access_code_fails.count_documents({"student_id": user["id"], "item_id": body.item_id, "at": {"$gte": since}})
    if fails >= MAX_FAILS:
        raise HTTPException(status_code=429, detail=f"Terlalu banyak percobaan. Coba lagi dalam {FAIL_WINDOW_MIN} menit, atau hubungi gurumu.")
    row = await db.access_codes.find_one({"item_type": body.item_type, "item_id": body.item_id}, {"_id": 0})
    if not row or normalize(body.code) != row["code"]:
        await db.access_code_fails.insert_one({"student_id": user["id"], "item_id": body.item_id, "at": now_iso()})
        raise HTTPException(status_code=403, detail=wrong_code_message(body.item_type))
    await db.access_unlocks.insert_one({"id": new_id(), "item_type": body.item_type, "item_id": body.item_id,
                                        "student_id": user["id"], "unlocked_at": now_iso()})
    return {"ok": True}
