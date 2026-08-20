import io
import csv
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from database import db
from security import require_roles
from utils import class_sessions

router = APIRouter(prefix="/api/proctor", tags=["proctor"])
proctor_only = require_roles("proctor")


async def _school_students(school_id):
    if not school_id:
        return []
    students = await db.users.find(
        {"role": "student", "school_id": school_id}, {"_id": 0, "password_hash": 0}
    ).to_list(500)
    return students


@router.get("/dashboard")
async def dashboard(user: dict = Depends(proctor_only)):
    school_id = user.get("school_id")
    students = await _school_students(school_id)
    student_ids = [s["id"] for s in students]
    attempts = await db.attempts.find(
        {"student_id": {"$in": student_ids}, "status": "submitted"}, {"_id": 0, "per_question": 0}
    ).to_list(2000)
    avg = round(sum(a["percentage"] for a in attempts) / len(attempts), 1) if attempts else 0
    active_now = await db.attempts.count_documents({"student_id": {"$in": student_ids}, "status": "in_progress"})
    school = await db.schools.find_one({"id": school_id}, {"_id": 0})
    return {
        "school": school,
        "total_students": len(students),
        "total_attempts": len(attempts),
        "avg_score": avg,
        "active_now": active_now,
    }


@router.get("/monitoring")
async def monitoring(user: dict = Depends(proctor_only)):
    students = await _school_students(user.get("school_id"))
    student_ids = [s["id"] for s in students]
    smap = {s["id"]: s for s in students}
    attempts = await db.attempts.find(
        {"student_id": {"$in": student_ids}}, {"_id": 0, "per_question": 0}
    ).to_list(2000)
    latest = {}
    for a in attempts:
        cur = latest.get(a["student_id"])
        key = a.get("submitted_at") or a.get("started_at") or ""
        if not cur or key > cur["_k"]:
            latest[a["student_id"]] = {**a, "_k": key}
    tos = await db.tryouts.find({}, {"_id": 0, "id": 1, "title": 1}).to_list(200)
    tmap = {t["id"]: t["title"] for t in tos}
    result = []
    for s in students:
        act = latest.get(s["id"])
        result.append({
            "student_id": s["id"],
            "name": s["name"],
            "email": s["email"],
            "status": act["status"] if act else "idle",
            "activity": tmap.get(act["tryout_id"], "-") if act else "Tidak ada aktivitas",
            "last_time": (act.get("submitted_at") or act.get("started_at")) if act else None,
            "last_score": act.get("percentage") if act and act["status"] == "submitted" else None,
        })
    return result


@router.get("/students")
async def students(user: dict = Depends(proctor_only)):
    students = await _school_students(user.get("school_id"))
    student_ids = [s["id"] for s in students]
    attempts = await db.attempts.find(
        {"student_id": {"$in": student_ids}, "status": "submitted"}, {"_id": 0, "per_question": 0}
    ).to_list(2000)
    by_student = {}
    for a in attempts:
        by_student.setdefault(a["student_id"], []).append(a)
    for s in students:
        rows = by_student.get(s["id"], [])
        s["attempts_count"] = len(rows)
        s["avg_score"] = round(sum(r["percentage"] for r in rows) / len(rows), 1) if rows else None
    return students


@router.get("/reports")
async def reports(user: dict = Depends(proctor_only)):
    students = await _school_students(user.get("school_id"))
    smap = {s["id"]: s for s in students}
    student_ids = list(smap.keys())
    attempts = await db.attempts.find(
        {"student_id": {"$in": student_ids}, "status": "submitted"}, {"_id": 0, "per_question": 0}
    ).to_list(2000)
    tos = await db.tryouts.find({}, {"_id": 0}).to_list(200)
    tmap = {t["id"]: t for t in tos}
    rows = []
    for a in attempts:
        rows.append({
            "student_name": smap.get(a["student_id"], {}).get("name", "-"),
            "tryout_title": tmap.get(a["tryout_id"], {}).get("title", "-"),
            "subject": tmap.get(a["tryout_id"], {}).get("subject", "-"),
            "score": a["score"],
            "max_score": a["max_score"],
            "percentage": a["percentage"],
            "submitted_at": a.get("submitted_at"),
        })
    rows.sort(key=lambda r: r.get("submitted_at") or "", reverse=True)
    return rows


@router.get("/reports/csv")
async def reports_csv(user: dict = Depends(proctor_only)):
    rows = await reports(user)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Nama Siswa", "Try Out", "Mata Pelajaran", "Nilai", "Nilai Maks", "Persentase", "Waktu Submit"])
    for r in rows:
        writer.writerow([r["student_name"], r["tryout_title"], r["subject"], r["score"],
                         r["max_score"], r["percentage"], r["submitted_at"]])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=laporan_nilai.csv"},
    )


@router.get("/analytics")
async def analytics(user: dict = Depends(proctor_only)):
    students = await _school_students(user.get("school_id"))
    smap = {s["id"]: s for s in students}
    student_ids = list(smap.keys())
    attempts = await db.attempts.find(
        {"student_id": {"$in": student_ids}, "status": "submitted"}, {"_id": 0, "per_question": 0}
    ).to_list(2000)
    tos = await db.tryouts.find({}, {"_id": 0}).to_list(200)
    tmap = {t["id"]: t for t in tos}

    # Per-student trend across tryouts (sorted by tryout start / submit time)
    per_student = []
    for s in students:
        rows = [a for a in attempts if a["student_id"] == s["id"]]
        rows.sort(key=lambda a: (tmap.get(a["tryout_id"], {}).get("start_at") or a.get("submitted_at") or ""))
        trend = [{
            "tryout": tmap.get(a["tryout_id"], {}).get("title", "-"),
            "percentage": a["percentage"],
            "date": tmap.get(a["tryout_id"], {}).get("start_at") or a.get("submitted_at"),
        } for a in rows]
        if len(trend) >= 2:
            direction = "up" if trend[-1]["percentage"] > trend[0]["percentage"] else ("down" if trend[-1]["percentage"] < trend[0]["percentage"] else "flat")
        else:
            direction = "flat"
        per_student.append({
            "student_id": s["id"],
            "name": s["name"],
            "trend": trend,
            "avg": round(sum(t["percentage"] for t in trend) / len(trend), 1) if trend else None,
            "direction": direction,
        })

    # Class average per tryout (chronological)
    ordered_tos = sorted([t for t in tos], key=lambda t: t.get("start_at") or "")
    class_trend = []
    for t in ordered_tos:
        rows = [a for a in attempts if a["tryout_id"] == t["id"]]
        if rows:
            class_trend.append({
                "tryout": t["title"],
                "avg": round(sum(r["percentage"] for r in rows) / len(rows), 1),
                "participants": len(rows),
            })
    return {"per_student": per_student, "class_trend": class_trend}


@router.get("/broadcasts")
async def broadcasts(user: dict = Depends(proctor_only)):
    return await db.broadcasts.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)


@router.get("/attendance")
async def attendance_recap(user: dict = Depends(proctor_only)):
    students = await _school_students(user.get("school_id"))
    if not students:
        return []
    student_ids = [s["id"] for s in students]
    enrolls = await db.enrollments.find({"student_id": {"$in": student_ids}}, {"_id": 0}).to_list(5000)
    by_student_courses = {}
    for e in enrolls:
        by_student_courses.setdefault(e["student_id"], set()).add(e["course_id"])
    slots = await db.teaching_slots.find({"status": "confirmed"}, {"_id": 0}).to_list(500)
    sessions_by_course = {}
    for sl in slots:
        cid = sl.get("course_id")
        if not cid:
            continue
        sessions_by_course[cid] = sessions_by_course.get(cid, 0) + len(class_sessions(sl))
    att = await db.attendance.find({"student_id": {"$in": student_ids}}, {"_id": 0}).to_list(20000)
    attended_by_student = {}
    for a in att:
        if a.get("status") in ("present", "late"):
            attended_by_student[a["student_id"]] = attended_by_student.get(a["student_id"], 0) + 1
    rows = []
    for s in students:
        courses = by_student_courses.get(s["id"], set())
        total = sum(sessions_by_course.get(c, 0) for c in courses)
        attended = attended_by_student.get(s["id"], 0)
        rate = round(attended / total * 100) if total else 0
        rows.append({
            "student_id": s["id"], "name": s["name"], "grade": s.get("grade"),
            "attended": attended, "total_sessions": total, "rate": rate,
        })
    rows.sort(key=lambda r: r["rate"], reverse=True)
    return rows


@router.get("/trainings")
async def trainings(user: dict = Depends(proctor_only)):
    students = await _school_students(user.get("school_id"))
    smap = {s["id"]: s["name"] for s in students}
    student_ids = list(smap.keys())
    if not student_ids:
        return []
    enrolls = await db.enrollments.find({"student_id": {"$in": student_ids}}, {"_id": 0}).to_list(2000)
    courses = await db.courses.find({}, {"_id": 0}).to_list(500)
    cmap = {c["id"]: c for c in courses}
    by_course = {}
    for e in enrolls:
        by_course.setdefault(e["course_id"], []).append(e["student_id"])
    result = []
    for cid, sids in by_course.items():
        c = cmap.get(cid, {})
        result.append({
            "course_id": cid,
            "title": c.get("title", "-"),
            "subject": c.get("subject", "-"),
            "level": c.get("level", "-"),
            "participants": len(sids),
            "students": [smap.get(s, "-") for s in sids],
        })
    result.sort(key=lambda r: r["participants"], reverse=True)
    return result


@router.get("/favorites")
async def favorites(user: dict = Depends(proctor_only)):
    students = await _school_students(user.get("school_id"))
    smap = {s["id"]: s["name"] for s in students}
    student_ids = list(smap.keys())
    rows = await db.favorites.find({"student_id": {"$in": student_ids}}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    cids = list({r["course_id"] for r in rows})
    courses = await db.courses.find({"id": {"$in": cids}}, {"_id": 0, "id": 1, "title": 1}).to_list(500)
    cmap = {c["id"]: c["title"] for c in courses}
    for r in rows:
        r["student_name"] = smap.get(r["student_id"], "-")
        r["course_title"] = cmap.get(r["course_id"], "-")
    return rows
