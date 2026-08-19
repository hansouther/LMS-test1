from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, List

from database import db
from utils import new_id, now_iso
from security import require_roles
from grading import strip_answers, grade_attempt

router = APIRouter(prefix="/api/student", tags=["student"])
student_only = require_roles("student")


class SubmitBody(BaseModel):
    answers: Dict[str, List[str]]


async def _enrolled_course_ids(student_id: str):
    rows = await db.enrollments.find({"student_id": student_id}, {"_id": 0}).to_list(200)
    return [r["course_id"] for r in rows]


@router.get("/dashboard")
async def dashboard(user: dict = Depends(student_only)):
    sid = user["id"]
    enrollments = await db.enrollments.count_documents({"student_id": sid})
    attempts = await db.attempts.find({"student_id": sid, "status": "submitted"}, {"_id": 0}).to_list(200)
    avg = round(sum(a["percentage"] for a in attempts) / len(attempts), 1) if attempts else 0
    available_to = await db.tryouts.count_documents({"published": True, "kind": {"$ne": "exercise"}})
    materials = await db.materials.count_documents({"visibility": "public"})
    recent = sorted(attempts, key=lambda a: a.get("submitted_at", ""), reverse=True)[:5]
    return {
        "enrollments": enrollments,
        "completed_tryouts": len(attempts),
        "avg_score": avg,
        "available_tryouts": available_to,
        "public_materials": materials,
        "recent_attempts": recent,
    }


@router.get("/courses")
async def courses(user: dict = Depends(student_only)):
    items = await db.courses.find({"active": True}, {"_id": 0}).sort("created_at", -1).to_list(100)
    enrolled = set(await _enrolled_course_ids(user["id"]))
    for c in items:
        c["enrolled"] = c["id"] in enrolled
    return items


@router.post("/courses/{course_id}/enroll")
async def enroll(course_id: str, user: dict = Depends(student_only)):
    course = await db.courses.find_one({"id": course_id, "active": True}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Kursus tidak ditemukan")
    exists = await db.enrollments.find_one({"course_id": course_id, "student_id": user["id"]})
    if exists:
        raise HTTPException(status_code=400, detail="Anda sudah terdaftar di kursus ini")
    await db.enrollments.insert_one({
        "id": new_id(),
        "course_id": course_id,
        "student_id": user["id"],
        "status": "active",
        "enrolled_at": now_iso(),
    })
    return {"ok": True}


@router.get("/enrollments")
async def my_enrollments(user: dict = Depends(student_only)):
    rows = await db.enrollments.find({"student_id": user["id"]}, {"_id": 0}).to_list(200)
    course_ids = [r["course_id"] for r in rows]
    courses = await db.courses.find({"id": {"$in": course_ids}}, {"_id": 0}).to_list(200)
    cmap = {c["id"]: c for c in courses}
    for r in rows:
        r["course"] = cmap.get(r["course_id"])
    return rows


@router.get("/courses/{course_id}/learn")
async def course_learn(course_id: str, user: dict = Depends(student_only)):
    if not await db.enrollments.find_one({"course_id": course_id, "student_id": user["id"]}):
        raise HTTPException(status_code=403, detail="Anda belum terdaftar di kursus ini")
    course = await db.courses.find_one({"id": course_id}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Kursus tidak ditemukan")
    lessons = await db.lessons.find({"course_id": course_id}, {"_id": 0}).sort("order", 1).to_list(200)
    exercises = await db.tryouts.find(
        {"course_id": course_id, "kind": "exercise", "published": True}, {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    ex_ids = [e["id"] for e in exercises]
    my_attempts = await db.attempts.find(
        {"student_id": user["id"], "tryout_id": {"$in": ex_ids}}, {"_id": 0, "per_question": 0}
    ).to_list(500)
    amap = {a["tryout_id"]: a for a in my_attempts}
    for ex in exercises:
        ex["question_count"] = await db.questions.count_documents({"tryout_id": ex["id"]})
        att = amap.get(ex["id"])
        ex["attempt_status"] = att["status"] if att else None
        ex["attempt_id"] = att["id"] if att else None
        ex["my_percentage"] = att.get("percentage") if att and att["status"] == "submitted" else None
        ex["my_score"] = att.get("score") if att and att["status"] == "submitted" else None
        ex["my_max"] = att.get("max_score") if att and att["status"] == "submitted" else None
    exercises = [e for e in exercises if e.get("question_count", 0) > 0]
    taken = [a for a in my_attempts if a["status"] == "submitted"]
    total_points = sum(a.get("score", 0) for a in taken)
    average = round(sum(a["percentage"] for a in taken) / len(taken), 1) if taken else 0
    grade = {
        "total_points": total_points,
        "average": average,
        "taken": len(taken),
        "total": len(exercises),
    }
    return {"course": course, "lessons": lessons, "exercises": exercises, "grade": grade}


@router.get("/materials")
async def materials(user: dict = Depends(student_only)):
    course_ids = await _enrolled_course_ids(user["id"])
    query = {"$or": [{"visibility": "public"}, {"visibility": "private", "course_id": {"$in": course_ids}}]}
    items = await db.materials.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    tutor_ids = list({m["tutor_id"] for m in items if m.get("tutor_id")})
    tutors = await db.users.find({"id": {"$in": tutor_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(200)
    tmap = {t["id"]: t["name"] for t in tutors}
    for m in items:
        m["tutor_name"] = tmap.get(m.get("tutor_id"), "Tim Akademik")
    return items


@router.get("/schedule")
async def schedule(user: dict = Depends(student_only)):
    course_ids = await _enrolled_course_ids(user["id"])
    slots = await db.teaching_slots.find(
        {"status": "confirmed", "$or": [{"course_id": {"$in": course_ids}}, {"open_to_all": True}]},
        {"_id": 0},
    ).sort("date", 1).to_list(200)
    tutor_ids = list({s["tutor_id"] for s in slots if s.get("tutor_id")})
    tutors = await db.users.find({"id": {"$in": tutor_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(200)
    tmap = {t["id"]: t["name"] for t in tutors}
    for s in slots:
        s["tutor_name"] = tmap.get(s.get("tutor_id"), "-")
    return slots


@router.get("/tryouts")
async def tryouts(user: dict = Depends(student_only)):
    items = await db.tryouts.find({"published": True, "kind": {"$ne": "exercise"}}, {"_id": 0}).sort("start_at", -1).to_list(100)
    my_attempts = await db.attempts.find({"student_id": user["id"]}, {"_id": 0}).to_list(200)
    amap = {a["tryout_id"]: a for a in my_attempts}
    for t in items:
        qcount = await db.questions.count_documents({"tryout_id": t["id"]})
        t["question_count"] = qcount
        att = amap.get(t["id"])
        t["attempt_status"] = att["status"] if att else None
        t["attempt_id"] = att["id"] if att else None
        t["my_percentage"] = att.get("percentage") if att and att["status"] == "submitted" else None
    return items


@router.get("/tryouts/{tryout_id}")
async def tryout_detail(tryout_id: str, user: dict = Depends(student_only)):
    t = await db.tryouts.find_one({"id": tryout_id, "published": True}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Try Out tidak ditemukan")
    questions = await db.questions.find({"tryout_id": tryout_id}, {"_id": 0}).sort("order", 1).to_list(200)
    t["questions"] = [strip_answers(q) for q in questions]
    return t


@router.post("/tryouts/{tryout_id}/start")
async def start_attempt(tryout_id: str, user: dict = Depends(student_only)):
    t = await db.tryouts.find_one({"id": tryout_id, "published": True}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Try Out tidak ditemukan")
    existing = await db.attempts.find_one({"tryout_id": tryout_id, "student_id": user["id"]}, {"_id": 0})
    if existing:
        if existing["status"] == "submitted":
            raise HTTPException(status_code=400, detail="Anda sudah menyelesaikan Try Out ini")
        return existing
    attempt = {
        "id": new_id(),
        "tryout_id": tryout_id,
        "student_id": user["id"],
        "status": "in_progress",
        "answers": {},
        "score": 0,
        "max_score": 0,
        "percentage": 0,
        "per_question": [],
        "started_at": now_iso(),
        "submitted_at": None,
        "duration_minutes": t.get("duration_minutes", 60),
    }
    await db.attempts.insert_one(attempt)
    return {k: v for k, v in attempt.items() if k != "_id"}


@router.post("/attempts/{attempt_id}/submit")
async def submit_attempt(attempt_id: str, body: SubmitBody, user: dict = Depends(student_only)):
    attempt = await db.attempts.find_one({"id": attempt_id, "student_id": user["id"]}, {"_id": 0})
    if not attempt:
        raise HTTPException(status_code=404, detail="Percobaan tidak ditemukan")
    if attempt["status"] == "submitted":
        raise HTTPException(status_code=400, detail="Percobaan sudah dikumpulkan")
    questions = await db.questions.find({"tryout_id": attempt["tryout_id"]}, {"_id": 0}).to_list(200)
    result = grade_attempt(questions, body.answers)
    await db.attempts.update_one(
        {"id": attempt_id},
        {"$set": {
            "answers": body.answers,
            "status": "submitted",
            "submitted_at": now_iso(),
            **result,
        }},
    )
    return {"ok": True, "score": result["score"], "max_score": result["max_score"], "percentage": result["percentage"]}


@router.get("/attempts")
async def my_attempts(user: dict = Depends(student_only)):
    rows = await db.attempts.find({"student_id": user["id"], "status": "submitted"}, {"_id": 0, "per_question": 0}).to_list(200)
    tids = list({r["tryout_id"] for r in rows})
    tos = await db.tryouts.find({"id": {"$in": tids}}, {"_id": 0}).to_list(200)
    tmap = {t["id"]: t for t in tos}
    for r in rows:
        r["tryout"] = tmap.get(r["tryout_id"])
    return sorted(rows, key=lambda r: r.get("submitted_at", ""), reverse=True)


@router.get("/attempts/{attempt_id}")
async def attempt_detail(attempt_id: str, user: dict = Depends(student_only)):
    attempt = await db.attempts.find_one({"id": attempt_id, "student_id": user["id"]}, {"_id": 0})
    if not attempt:
        raise HTTPException(status_code=404, detail="Hasil tidak ditemukan")
    t = await db.tryouts.find_one({"id": attempt["tryout_id"]}, {"_id": 0})
    questions = await db.questions.find({"tryout_id": attempt["tryout_id"]}, {"_id": 0}).sort("order", 1).to_list(200)
    qmap = {q["id"]: q for q in questions}
    for pq in attempt.get("per_question", []):
        q = qmap.get(pq["question_id"])
        if q:
            pq["text"] = q["text"]
            pq["options"] = q.get("options", [])
    attempt["tryout"] = t
    return attempt
