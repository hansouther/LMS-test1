from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr

from database import db
from utils import new_id, now_iso

router = APIRouter(prefix="/api/public", tags=["public"])

# Public read endpoints are cacheable so a CDN/reverse-proxy can absorb heavy
# read traffic (landing, calendar, news) without hitting the app on every hit.
_CACHE = "public, max-age=60, stale-while-revalidate=300"


class PartnershipBody(BaseModel):
    org_name: str
    contact_name: str
    email: EmailStr
    phone: str
    org_type: str
    student_count: int
    message: str | None = None


@router.get("/news")
async def get_news(response: Response):
    response.headers["Cache-Control"] = _CACHE
    items = await db.news.find({"published": True}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return items


@router.get("/news/{news_id}")
async def get_news_item(news_id: str, response: Response):
    response.headers["Cache-Control"] = _CACHE
    item = await db.news.find_one({"id": news_id, "published": True}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Berita tidak ditemukan")
    return item


@router.get("/calendar")
async def get_calendar(response: Response):
    response.headers["Cache-Control"] = _CACHE
    items = await db.calendar_events.find({}, {"_id": 0}).sort("date", 1).to_list(200)
    return items


@router.get("/time")
async def server_time():
    now = datetime.now(timezone.utc)
    return {"iso": now.isoformat(), "year": now.year, "month": now.month, "day": now.day}


@router.get("/sitemap.xml")
async def sitemap(request: Request):
    proto = request.headers.get("x-forwarded-proto", "https")
    host = request.headers.get("x-forwarded-host") or request.headers.get("host", "")
    base = f"{proto}://{host}".rstrip("/")
    news = await db.news.find({"published": True}, {"_id": 0, "id": 1, "created_at": 1}).sort("created_at", -1).to_list(1000)
    urls = []
    for path, freq in [("/", "daily"), ("/kalender", "weekly"), ("/berita", "daily"), ("/kursus", "weekly")]:
        urls.append(f"  <url><loc>{base}{path}</loc><changefreq>{freq}</changefreq></url>")
    for n in news:
        lastmod = (n.get("created_at") or "")[:10]
        urls.append(f"  <url><loc>{base}/berita/{n['id']}</loc><lastmod>{lastmod}</lastmod><changefreq>weekly</changefreq></url>")
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>\n"
    )
    return Response(content=xml, media_type="application/xml", headers={"Cache-Control": _CACHE})


@router.get("/courses")
async def get_courses():
    items = await db.courses.find({"active": True}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return items


@router.get("/schools")
async def get_schools():
    items = await db.schools.find({}, {"_id": 0}).sort("name", 1).to_list(200)
    return items


@router.get("/stats")
async def public_stats(response: Response):
    response.headers["Cache-Control"] = _CACHE
    students = await db.users.count_documents({"role": "student"})
    tutors = await db.users.count_documents({"role": "tutor"})
    courses = await db.courses.count_documents({"active": True})
    schools = await db.schools.count_documents({})
    return {"students": students, "tutors": tutors, "courses": courses, "schools": schools}


@router.post("/partnerships")
async def submit_partnership(body: PartnershipBody):
    doc = {
        "id": new_id(),
        **body.model_dump(),
        "status": "new",
        "created_at": now_iso(),
    }
    await db.partnerships.insert_one(doc)
    return {"ok": True, "id": doc["id"]}
