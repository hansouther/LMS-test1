import uuid
import asyncio
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Response

from database import db
from utils import now_iso
from security import require_roles, get_current_user
from storage import put_object, get_object, MIME_TYPES, APP_NAME

router = APIRouter(prefix="/api", tags=["files"])
uploader = require_roles("admin", "tutor")


@router.post("/upload")
async def upload(file: UploadFile = File(...), user: dict = Depends(uploader)):
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "bin"
    file_id = uuid.uuid4().hex
    path = f"{APP_NAME}/uploads/{user['id']}/{file_id}.{ext}"
    data = await file.read()
    content_type = file.content_type or MIME_TYPES.get(ext, "application/octet-stream")
    try:
        result = await asyncio.to_thread(put_object, path, data, content_type)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gagal mengunggah berkas: {e}")
    doc = {
        "id": file_id,
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": content_type,
        "size": result.get("size", len(data)),
        "uploaded_by": user["id"],
        "is_deleted": False,
        "created_at": now_iso(),
    }
    await db.files.insert_one(doc)
    return {
        "id": file_id,
        "url": f"/api/files/{result['path']}",
        "filename": file.filename,
        "content_type": content_type,
        "size": doc["size"],
        "path": result["path"],
    }


@router.get("/files/{path:path}")
async def download(path: str, user: dict = Depends(get_current_user)):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Berkas tidak ditemukan")
    try:
        data, content_type = await asyncio.to_thread(get_object, path)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gagal memuat berkas: {e}")
    return Response(
        content=data,
        media_type=record.get("content_type", content_type),
        headers={"Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600"},
    )
