import os
import requests
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request, Response, Depends
from pydantic import BaseModel, EmailStr

from database import db
from utils import new_id, now_iso
from security import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    set_auth_cookies, clear_auth_cookies, get_current_user, get_jwt_secret,
)
import jwt

router = APIRouter(prefix="/api/auth", tags=["auth"])

EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
MAX_ATTEMPTS = 5
LOCK_MINUTES = 15


class RegisterBody(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: str | None = None
    school_id: str | None = None
    grade: str | None = None
    goal: str | None = None


class RegisterProctorBody(BaseModel):
    name: str          # nama PIC / penanggung jawab
    email: EmailStr
    password: str
    phone: str | None = None
    school_name: str   # nama sekolah (teks bebas, ditautkan admin saat verifikasi)


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class GoogleBody(BaseModel):
    session_id: str


def _public_user(user: dict) -> dict:
    user.pop("password_hash", None)
    return user


async def _issue_session(user: dict, response: Response):
    access = create_access_token(user["id"], user["role"])
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)


@router.post("/register")
async def register(body: RegisterBody, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    user = {
        "id": new_id(),
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": "student",
        "status": "pending",
        "phone": body.phone,
        "school_id": body.school_id,
        "grade": body.grade,
        "goal": body.goal,
        "picture": None,
        "auth_provider": "password",
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    await _issue_session(user, response)
    return _public_user({k: v for k, v in user.items() if k != "_id"})


@router.post("/register/proctor")
async def register_proctor(body: RegisterProctorBody, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    user = {
        "id": new_id(),
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": "proctor",
        "status": "pending",
        "phone": body.phone,
        "school_id": None,
        "school_name_text": body.school_name,
        "picture": None,
        "auth_provider": "password",
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    await _issue_session(user, response)
    return _public_user({k: v for k, v in user.items() if k != "_id"})


@router.post("/login")
async def login(body: LoginBody, request: Request, response: Response):
    email = body.email.lower()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"

    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("count", 0) >= MAX_ATTEMPTS:
        locked_until = attempt.get("locked_until")
        if locked_until and datetime.fromisoformat(locked_until) > datetime.now(timezone.utc):
            raise HTTPException(status_code=429, detail="Terlalu banyak percobaan. Coba lagi nanti.")

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        new_count = (attempt.get("count", 0) if attempt else 0) + 1
        locked_until = (datetime.now(timezone.utc) + timedelta(minutes=LOCK_MINUTES)).isoformat() if new_count >= MAX_ATTEMPTS else None
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$set": {"identifier": identifier, "count": new_count, "locked_until": locked_until}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Email atau kata sandi salah")

    await db.login_attempts.delete_one({"identifier": identifier})
    await _issue_session(user, response)
    return _public_user({k: v for k, v in user.items() if k != "_id"})


@router.post("/google/session")
async def google_session(body: GoogleBody, response: Response):
    try:
        r = requests.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": body.session_id}, timeout=10)
    except Exception:
        raise HTTPException(status_code=502, detail="Gagal menghubungi layanan autentikasi")
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Sesi Google tidak valid")
    data = r.json()
    email = data["email"].lower()
    user = await db.users.find_one({"email": email})
    if not user:
        user = {
            "id": new_id(),
            "email": email,
            "password_hash": None,
            "name": data.get("name") or email.split("@")[0],
            "role": "student",
            "status": "pending",
            "phone": None,
            "school_id": None,
            "grade": None,
            "goal": None,
            "picture": data.get("picture"),
            "auth_provider": "google",
            "created_at": now_iso(),
        }
        await db.users.insert_one(user)
    else:
        if data.get("picture") and not user.get("picture"):
            await db.users.update_one({"id": user["id"]}, {"$set": {"picture": data["picture"]}})
            user["picture"] = data["picture"]
    await _issue_session(user, response)
    return _public_user({k: v for k, v in user.items() if k != "_id"})


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Tidak ada refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=["HS256"])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Refresh token tidak valid")
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Tipe token salah")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Pengguna tidak ditemukan")
    access = create_access_token(user["id"], user["role"])
    response.set_cookie("access_token", access, httponly=True, secure=True,
                        samesite="none", max_age=86400, path="/")
    return {"ok": True}


@router.post("/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    clear_auth_cookies(response)
    return {"ok": True}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return user
