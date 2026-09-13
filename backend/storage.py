import os
import logging

logger = logging.getLogger(__name__)

# Buat folder 'uploads' di dalam direktori backend secara otomatis
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif",
    "webp": "image/webp", "pdf": "application/pdf", "csv": "text/csv", "txt": "text/plain",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "ppt": "application/vnd.ms-powerpoint",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "mp4": "video/mp4", "webm": "video/webm", "mov": "video/quicktime", "m4v": "video/x-m4v",
}

def put_object(path: str, data: bytes, content_type: str) -> dict:
    """Fungsi mandiri untuk menyimpan file ke folder lokal peladen."""
    try:
        safe_path = os.path.normpath(path).lstrip("/\\")
        full_path = os.path.join(UPLOAD_DIR, safe_path)
        
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        
        with open(full_path, "wb") as f:
            f.write(data)
            
        logger.info(f"File disimpan lokal: {safe_path}")
        return {"status": "success", "path": safe_path, "url": f"/uploads/{safe_path}"}
    except Exception as e:
        logger.error(f"Gagal menyimpan file: {e}")
        raise e

def get_object(path: str):
    """Fungsi mandiri untuk membaca file dari folder lokal."""
    try:
        safe_path = os.path.normpath(path).lstrip("/\\")
        full_path = os.path.join(UPLOAD_DIR, safe_path)
        
        if not os.path.exists(full_path):
            raise FileNotFoundError(f"Berkas tidak ditemukan: {path}")
            
        with open(full_path, "rb") as f:
            data = f.read()
            
        ext = path.split(".")[-1].lower() if "." in path else ""
        content_type = MIME_TYPES.get(ext, "application/octet-stream")
        
        return data, content_type
    except Exception as e:
        logger.error(f"Gagal mengambil file: {e}")
        raise e