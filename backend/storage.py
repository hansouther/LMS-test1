import os
import logging
import boto3
from botocore.config import Config

logger = logging.getLogger(__name__)

# Mencegah ImportError pada routes_auth.py
APP_NAME = "binaralms"

# Mengambil kredensial dari environment variables Railway
R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.environ.get("R2_BUCKET_NAME")
R2_PUBLIC_URL = (os.environ.get("R2_PUBLIC_URL") or "").rstrip("/")

# Inisialisasi klien S3 khusus untuk Cloudflare R2
if R2_ACCOUNT_ID and R2_ACCESS_KEY_ID:
    s3_client = boto3.client(
        service_name="s3",
        endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
    )
else:
    s3_client = None
    logger.warning("Kredensial R2 tidak lengkap di environment variables.")

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
    """Mengunggah file ke Cloudflare R2."""
    if not s3_client:
        raise RuntimeError("S3 client (Cloudflare R2) belum terinisialisasi.")
    
    try:
        safe_path = path.lstrip("/\\")
        s3_client.put_object(
            Bucket=R2_BUCKET_NAME,
            Key=safe_path,
            Body=data,
            ContentType=content_type
        )
        
        # Hasilkan URL publik dari R2.dev
        file_url = f"{R2_PUBLIC_URL}/{safe_path}" if R2_PUBLIC_URL else f"/api/files/{safe_path}"
        logger.info(f"File berhasil diunggah ke R2: {safe_path}")
        return {"status": "success", "path": safe_path, "url": file_url}
    except Exception as e:
        logger.error(f"Gagal mengunggah ke Cloudflare R2: {e}")
        raise e

def get_object(path: str):
    """Mengambil data file dari Cloudflare R2."""
    if not s3_client:
        raise RuntimeError("S3 client (Cloudflare R2) belum terinisialisasi.")
        
    try:
        safe_path = path.lstrip("/\\")
        response = s3_client.get_object(Bucket=R2_BUCKET_NAME, Key=safe_path)
        data = response["Body"].read()
        content_type = response.get("ContentType", "application/octet-stream")
        return data, content_type
    except Exception as e:
        logger.error(f"Gagal mengambil file dari R2: {e}")
        raise e