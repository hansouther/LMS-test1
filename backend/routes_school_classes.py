import re
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from pydantic import BaseModel
from typing import List, Optional

from database import db
from utils import new_id, now_iso
from security import require_roles
import analysis

router = APIRouter(prefix="/api", tags=["school-classes"])
admin_only = require_roles("admin")

LEVELS = {"SD": "SD / Sederajat", "SMP": "SMP / Sederajat", "SMA": "SMA / Sederajat"}
LEVEL_ORDER = {"SD": 0, "SMP": 1, "SMA": 2}


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip()).upper()


def _sort_key(c):
    parts = re.split(r"(\d+)", c["label"])
    return (LEVEL_ORDER.get(c["level"], 9), [int(p) if p.isdigit() else p for p in parts])


async def classes_of(school_id: str) -> list:
    items = await db.school_classes.find({"school_id": school_id}, {"_id": 0}).to_list(500)
    return sorted(items, key=_sort_key)


async def annotate(user: dict) -> dict:
    """Tandai siswa yang kelasnya belum sesuai daftar kelas resmi sekolahnya."""
    if not user or user.get("role") != "student":
        return user
    need = False
    sid = user.get("school_id")
    if sid and await db.school_classes.count_documents({"school_id": sid}):
        cid = user.get("class_id")
        need = not cid or not await db.school_classes.find_one({"id": cid, "school_id": sid}, {"_id": 1})
    user["needs_class"] = need
    return user


async def resolve_class(school_id: Optional[str], class_id: Optional[str], grade: Optional[str], level: Optional[str]) -> dict:
    """Validasi pilihan kelas siswa -> field yang disimpan (grade = label kelas resmi)."""
    if class_id:
        c = await db.school_classes.find_one({"id": class_id}, {"_id": 0})
        if not c or (school_id and c["school_id"] != school_id):
            raise HTTPException(status_code=400, detail="Kelas tidak ditemukan untuk sekolah ini")
        return {"class_id": c["id"], "grade": c["label"], "level": c["level"]}
    if school_id and await db.school_classes.count_documents({"school_id": school_id}):
        raise HTTPException(status_code=400, detail="Pilih jenjang dan kelas dari daftar yang ditentukan admin")
    out = {"class_id": None}
    if grade is not None:
        out["grade"] = grade.strip()
    if level in LEVELS:
        out["level"] = level
    return out


@router.get("/public/schools/{school_id}/classes")
async def public_classes(school_id: str):
    return [{"id": c["id"], "level": c["level"], "label": c["label"]} for c in await classes_of(school_id)]


@router.get("/admin/schools/{school_id}/classes")
async def admin_classes(school_id: str, user: dict = Depends(admin_only)):
    items = await classes_of(school_id)
    for c in items:
        c["student_count"] = await db.users.count_documents({"role": "student", "class_id": c["id"]})
    mismatch = 0
    if items:
        ids = [c["id"] for c in items]
        mismatch = await db.users.count_documents({"role": "student", "school_id": school_id, "class_id": {"$nin": ids}})
    return {"items": items, "mismatch": mismatch}


class ClassBulkBody(BaseModel):
    level: str
    labels: List[str]


@router.post("/admin/schools/{school_id}/classes")
async def create_classes(school_id: str, body: ClassBulkBody, user: dict = Depends(admin_only)):
    if body.level not in LEVELS:
        raise HTTPException(status_code=400, detail="Jenjang tidak valid")
    if not await db.schools.find_one({"id": school_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Sekolah tidak ditemukan")
    existing = {_norm(c["label"]) for c in await classes_of(school_id)}
    docs = []
    for raw in body.labels[:100]:
        label = _norm(raw)
        if not label or label in existing:
            continue
        existing.add(label)
        docs.append({"id": new_id(), "school_id": school_id, "level": body.level, "label": label, "created_at": now_iso()})
    if docs:
        await db.school_classes.insert_many(docs)
    return {"created": len(docs), "skipped": len(body.labels) - len(docs)}


class ClassUpdateBody(BaseModel):
    label: str
    level: str


@router.put("/admin/school-classes/{class_id}")
async def update_class(class_id: str, body: ClassUpdateBody, user: dict = Depends(admin_only)):
    c = await db.school_classes.find_one({"id": class_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Kelas tidak ditemukan")
    label = _norm(body.label)
    if not label or body.level not in LEVELS:
        raise HTTPException(status_code=400, detail="Nama kelas / jenjang tidak valid")
    dup = await db.school_classes.find_one({"school_id": c["school_id"], "label": label, "id": {"$ne": class_id}}, {"_id": 1})
    if dup:
        raise HTTPException(status_code=400, detail="Nama kelas sudah ada di sekolah ini")
    await db.school_classes.update_one({"id": class_id}, {"$set": {"label": label, "level": body.level}})
    await db.users.update_many({"class_id": class_id}, {"$set": {"grade": label, "level": body.level}})
    return {"ok": True}


@router.delete("/admin/school-classes/{class_id}")
async def delete_class(class_id: str, user: dict = Depends(admin_only)):
    await db.school_classes.delete_one({"id": class_id})
    return {"ok": True}


async def _class_or_404(class_id: str) -> dict:
    c = await db.school_classes.find_one({"id": class_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Kelas tidak ditemukan")
    return c


@router.get("/admin/school-classes/{class_id}/students")
async def class_students(class_id: str, user: dict = Depends(admin_only)):
    await _class_or_404(class_id)
    return await db.users.find({"role": "student", "class_id": class_id},
                               {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1}).sort("name", 1).to_list(1000)


@router.get("/admin/school-classes/{class_id}/scores.csv")
async def class_scores_csv(class_id: str, user: dict = Depends(admin_only)):
    c = await _class_or_404(class_id)
    ids = [u["id"] for u in await db.users.find({"role": "student", "class_id": class_id}, {"_id": 0, "id": 1}).to_list(1000)]
    rep = await analysis.build_report(ids)
    name = re.sub(r"[^A-Za-z0-9_-]+", "_", c["label"])
    return Response(content=analysis.scores_csv(rep), media_type="text/csv",
                    headers={"Content-Disposition": f"attachment; filename=nilai_kelas_{name}.csv"})
