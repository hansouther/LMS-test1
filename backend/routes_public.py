from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr

from database import db
from utils import new_id, now_iso, class_sessions

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
    # Merge confirmed class sessions so the public calendar shows live class activity
    slots = await db.teaching_slots.find({"status": "confirmed"}, {"_id": 0}).to_list(500)
    tutor_ids = list({s.get("tutor_id") for s in slots if s.get("tutor_id")})
    tutors = await db.users.find({"id": {"$in": tutor_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(500)
    tmap = {t["id"]: t["name"] for t in tutors}
    for sl in slots:
        tutor_name = tmap.get(sl.get("tutor_id"), "Tim Pengajar")
        for se in class_sessions(sl):
            items.append({
                "id": f"cls_{sl['id']}_{se['id']}",
                "title": sl.get("title", "Kelas Pelatihan"),
                "date": se.get("date"),
                "type": "class",
                "description": se.get("topic") or f"Pertemuan {se.get('no')}",
                "tutor": tutor_name,
                "subject": sl.get("subject"),
                "start_time": se.get("start_time"),
                "end_time": se.get("end_time"),
            })
    items.sort(key=lambda x: x.get("date") or "")
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


@router.get("/courses/{course_id}")
async def get_course_detail(course_id: str, response: Response):
    response.headers["Cache-Control"] = _CACHE
    course = await db.courses.find_one({"id": course_id, "active": True}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Kursus tidak ditemukan")
    lessons = await db.lessons.find({"course_id": course_id}, {"_id": 0}).sort("order", 1).to_list(200)
    syllabus = [{
        "id": l["id"],
        "title": l["title"],
        "description": l.get("description"),
        "video_type": l.get("video_type"),
        "attachment_count": len(l.get("attachments") or []),
    } for l in lessons]
    exercise_count = await db.tryouts.count_documents({"course_id": course_id})
    subject = course.get("subject", "")
    tutors = await db.users.find(
        {"role": "tutor", "status": {"$ne": "rejected"}, "qualifications": subject},
        {"_id": 0, "name": 1, "qualifications": 1, "picture": 1},
    ).to_list(50)
    return {
        "course": course,
        "syllabus": syllabus,
        "lesson_count": len(syllabus),
        "exercise_count": exercise_count,
        "tutors": tutors,
    }


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
