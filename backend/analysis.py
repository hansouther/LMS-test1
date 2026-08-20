"""Weakness analysis & score reporting.

Aggregates submitted attempts into three views used for reporting to schools:
- scores : one row per attempt (nilai per Try Out)
- recap  : one row per student (rata-rata, mapel terlemah, Numerasi vs Literasi, tren)
- items  : one row per question (analisis butir: % benar, tingkat kesulitan)

Competency grouping follows AKM style: numerasi vs literasi (umum = tak berlabel).
"""
import io
import csv

from database import db

COMP_LABEL = {"numerasi": "Numerasi", "literasi": "Literasi", "umum": "Umum"}


def norm_comp(v):
    v = (v or "umum").strip().lower()
    return v if v in ("numerasi", "literasi") else "umum"


def _difficulty(pct):
    if pct is None:
        return "-"
    if pct >= 70:
        return "Mudah"
    if pct >= 40:
        return "Sedang"
    return "Sulit"


def _kind_label(t):
    return "Latihan" if (t or {}).get("kind") == "exercise" else "Try Out"


async def build_report(student_ids=None):
    """student_ids=None -> semua siswa (admin). List -> hanya siswa tsb (proktor per sekolah)."""
    query = {"status": "submitted"}
    if student_ids is not None:
        query["student_id"] = {"$in": student_ids}
    attempts = await db.attempts.find(query, {"_id": 0}).to_list(10000)

    sids = list({a["student_id"] for a in attempts})
    users = await db.users.find(
        {"id": {"$in": sids}}, {"_id": 0, "id": 1, "name": 1, "school_id": 1, "grade": 1, "email": 1}
    ).to_list(5000)
    umap = {u["id"]: u for u in users}
    schools = await db.schools.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(500)
    school_map = {s["id"]: s["name"] for s in schools}
    tryouts = await db.tryouts.find(
        {}, {"_id": 0, "id": 1, "title": 1, "subject": 1, "kind": 1, "start_at": 1}
    ).to_list(1000)
    tmap = {t["id"]: t for t in tryouts}
    questions = await db.questions.find(
        {}, {"_id": 0, "id": 1, "competency": 1, "text": 1, "tryout_id": 1, "order": 1}
    ).to_list(50000)
    qmap = {q["id"]: q for q in questions}

    # ---- scores: per attempt ----
    scores = []
    for a in attempts:
        t = tmap.get(a["tryout_id"], {})
        u = umap.get(a["student_id"], {})
        pq = a.get("per_question") or []
        cc = sum(1 for p in pq if p.get("correct"))
        scores.append({
            "student_name": u.get("name", "-"),
            "school_name": school_map.get(u.get("school_id")) or "-",
            "grade": u.get("grade") or "-",
            "tryout_title": t.get("title", "-"),
            "kind": _kind_label(t),
            "subject": t.get("subject", "-"),
            "score": a.get("score", 0),
            "max_score": a.get("max_score", 0),
            "percentage": a.get("percentage", 0),
            "correct_count": cc if pq else None,
            "wrong_count": (len(pq) - cc) if pq else None,
            "submitted_at": a.get("submitted_at"),
        })
    scores.sort(key=lambda r: r.get("submitted_at") or "", reverse=True)

    # ---- recap: per student ----
    by_student = {}
    for a in attempts:
        by_student.setdefault(a["student_id"], []).append(a)

    recap = []
    for sid, rows in by_student.items():
        u = umap.get(sid, {})
        subj = {}
        for a in rows:
            s = tmap.get(a["tryout_id"], {}).get("subject", "-")
            subj.setdefault(s, []).append(a.get("percentage", 0))
        subj_avg = {s: round(sum(v) / len(v), 1) for s, v in subj.items()}
        weakest_subject = min(subj_avg, key=subj_avg.get) if subj_avg else "-"

        earned = {"numerasi": 0, "literasi": 0}
        points = {"numerasi": 0, "literasi": 0}
        for a in rows:
            for p in (a.get("per_question") or []):
                c = norm_comp(qmap.get(p.get("question_id"), {}).get("competency"))
                if c in earned:
                    earned[c] += p.get("earned", 0)
                    points[c] += p.get("points", 0)
        num_pct = round(earned["numerasi"] / points["numerasi"] * 100, 1) if points["numerasi"] else None
        lit_pct = round(earned["literasi"] / points["literasi"] * 100, 1) if points["literasi"] else None
        cand = {k: v for k, v in {"Numerasi": num_pct, "Literasi": lit_pct}.items() if v is not None}
        weakest_comp = min(cand, key=cand.get) if cand else "-"

        ordered = sorted(rows, key=lambda a: (tmap.get(a["tryout_id"], {}).get("start_at") or a.get("submitted_at") or ""))
        if len(ordered) >= 2:
            d = ordered[-1].get("percentage", 0) - ordered[0].get("percentage", 0)
            trend = "naik" if d > 0 else ("turun" if d < 0 else "stabil")
        else:
            trend = "stabil"

        recap.append({
            "student_id": sid,
            "name": u.get("name", "-"),
            "school_name": school_map.get(u.get("school_id")) or "-",
            "grade": u.get("grade") or "-",
            "attempts_count": len(rows),
            "avg_percentage": round(sum(a.get("percentage", 0) for a in rows) / len(rows), 1),
            "subject_avg": subj_avg,
            "weakest_subject": weakest_subject,
            "numerasi_pct": num_pct,
            "literasi_pct": lit_pct,
            "weakest_competency": weakest_comp,
            "trend": trend,
        })
    recap.sort(key=lambda r: r["avg_percentage"])

    # ---- items: per question ----
    agg = {}
    for a in attempts:
        for p in (a.get("per_question") or []):
            qid = p.get("question_id")
            if not qid:
                continue
            d = agg.setdefault(qid, {"answered": 0, "correct": 0})
            d["answered"] += 1
            if p.get("correct"):
                d["correct"] += 1
    items = []
    for qid, d in agg.items():
        q = qmap.get(qid, {})
        t = tmap.get(q.get("tryout_id"), {})
        pct = round(d["correct"] / d["answered"] * 100, 1) if d["answered"] else 0
        items.append({
            "tryout_title": t.get("title", "-"),
            "subject": t.get("subject", "-"),
            "competency": COMP_LABEL.get(norm_comp(q.get("competency")), "Umum"),
            "order": q.get("order", 0),
            "text": (q.get("text") or "").strip()[:120],
            "answered_count": d["answered"],
            "correct_count": d["correct"],
            "correct_pct": pct,
            "difficulty": _difficulty(pct),
        })
    items.sort(key=lambda r: r["correct_pct"])

    # ---- summary ----
    total_attempts = len(attempts)
    class_avg = round(sum(a.get("percentage", 0) for a in attempts) / total_attempts, 1) if total_attempts else 0
    subj_all = {}
    for a in attempts:
        s = tmap.get(a["tryout_id"], {}).get("subject", "-")
        subj_all.setdefault(s, []).append(a.get("percentage", 0))
    subject_avg = {s: round(sum(v) / len(v), 1) for s, v in subj_all.items()}
    ce = {"numerasi": 0, "literasi": 0}
    cp = {"numerasi": 0, "literasi": 0}
    for a in attempts:
        for p in (a.get("per_question") or []):
            c = norm_comp(qmap.get(p.get("question_id"), {}).get("competency"))
            if c in ce:
                ce[c] += p.get("earned", 0)
                cp[c] += p.get("points", 0)
    comp_avg = {
        "numerasi": round(ce["numerasi"] / cp["numerasi"] * 100, 1) if cp["numerasi"] else None,
        "literasi": round(ce["literasi"] / cp["literasi"] * 100, 1) if cp["literasi"] else None,
    }
    cand = {k: v for k, v in comp_avg.items() if v is not None}
    summary = {
        "total_students": len(by_student),
        "total_attempts": total_attempts,
        "class_avg": class_avg,
        "subject_avg": subject_avg,
        "competency_avg": comp_avg,
        "weakest_subject": min(subject_avg, key=subject_avg.get) if subject_avg else None,
        "weakest_competency": COMP_LABEL.get(min(cand, key=cand.get)) if cand else None,
    }
    return {"scores": scores, "recap": recap, "items": items, "summary": summary}


def _csv(headers, rows):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(headers)
    for r in rows:
        w.writerow(r)
    buf.seek(0)
    return buf.getvalue()


def scores_csv(report):
    rows = [[r["student_name"], r["school_name"], r["grade"], r["tryout_title"], r["kind"], r["subject"],
             r["score"], r["max_score"], r["percentage"],
             "" if r["correct_count"] is None else r["correct_count"],
             "" if r["wrong_count"] is None else r["wrong_count"], r["submitted_at"]]
            for r in report["scores"]]
    return _csv(["Nama Siswa", "Sekolah", "Kelas", "Try Out", "Jenis", "Mata Pelajaran",
                 "Skor", "Skor Maks", "Persentase", "Jumlah Benar", "Jumlah Salah", "Waktu Submit"], rows)


def recap_csv(report):
    rows = [[r["name"], r["school_name"], r["grade"], r["attempts_count"], r["avg_percentage"],
             r["weakest_subject"],
             "" if r["numerasi_pct"] is None else r["numerasi_pct"],
             "" if r["literasi_pct"] is None else r["literasi_pct"],
             r["weakest_competency"], r["trend"]]
            for r in report["recap"]]
    return _csv(["Nama Siswa", "Sekolah", "Kelas", "Jumlah TO", "Rata-rata (%)",
                 "Mapel Terlemah", "Numerasi (%)", "Literasi (%)", "Kompetensi Terlemah", "Tren"], rows)


def items_csv(report):
    rows = [[r["tryout_title"], r["subject"], r["competency"], r["order"], r["text"],
             r["answered_count"], r["correct_count"], r["correct_pct"], r["difficulty"]]
            for r in report["items"]]
    return _csv(["Try Out", "Mata Pelajaran", "Kompetensi", "No Soal", "Pertanyaan",
                 "Dijawab", "Benar", "% Benar", "Tingkat Kesulitan"], rows)
