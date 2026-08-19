from datetime import datetime, timezone, timedelta

from database import db
from security import hash_password
from utils import now_iso

SCHOOL1 = "school_nusantara"
SCHOOL2 = "school_harapan"


def _d(days_from_now: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days_from_now)).date().isoformat()


def _questions(tryout_id: str):
    return [
        {"id": f"{tryout_id}_q1", "tryout_id": tryout_id, "order": 1, "type": "single", "points": 20,
         "text": "Berapakah hasil dari 12 × 8?",
         "options": [{"id": "o1", "text": "80"}, {"id": "o2", "text": "96"}, {"id": "o3", "text": "108"}, {"id": "o4", "text": "86"}],
         "correct_answers": ["o2"]},
        {"id": f"{tryout_id}_q2", "tryout_id": tryout_id, "order": 2, "type": "multiple", "points": 20,
         "text": "Manakah dari berikut yang merupakan bilangan prima? (pilih semua yang benar)",
         "options": [{"id": "o1", "text": "2"}, {"id": "o2", "text": "4"}, {"id": "o3", "text": "7"}, {"id": "o4", "text": "9"}],
         "correct_answers": ["o1", "o3"]},
        {"id": f"{tryout_id}_q3", "tryout_id": tryout_id, "order": 3, "type": "truefalse", "points": 20,
         "text": "Air mendidih pada suhu 100°C di permukaan laut.",
         "options": [], "correct_answers": ["true"]},
        {"id": f"{tryout_id}_q4", "tryout_id": tryout_id, "order": 4, "type": "essay", "points": 20,
         "text": "Ibu kota negara Republik Indonesia adalah ____ (isi dengan satu kata).",
         "options": [], "correct_answers": ["Jakarta"]},
        {"id": f"{tryout_id}_q5", "tryout_id": tryout_id, "order": 5, "type": "single", "points": 20,
         "text": "Sinonim dari kata 'pandai' adalah ...",
         "options": [{"id": "o1", "text": "Cerdas"}, {"id": "o2", "text": "Malas"}, {"id": "o3", "text": "Lambat"}, {"id": "o4", "text": "Lemah"}],
         "correct_answers": ["o1"]},
    ]


async def seed(admin_email: str, admin_password: str):
    # Always ensure admin credentials are in sync
    existing_admin = await db.users.find_one({"email": admin_email})
    if not existing_admin:
        await db.users.insert_one({
            "id": "admin_root", "email": admin_email, "password_hash": hash_password(admin_password),
            "name": "Administrator", "role": "admin", "phone": None, "school_id": None,
            "picture": None, "auth_provider": "password", "created_at": now_iso(),
        })

    if await db.meta.find_one({"key": "seed_v1"}):
        return

    # Schools
    await db.schools.insert_many([
        {"id": SCHOOL1, "name": "SMA Nusantara 1", "city": "Jakarta", "created_at": now_iso()},
        {"id": SCHOOL2, "name": "SMA Harapan Bangsa", "city": "Bandung", "created_at": now_iso()},
    ])

    # Staff users
    await db.users.insert_many([
        {"id": "tutor_demo", "email": "tutor@lms.id", "password_hash": hash_password("Tutor@12345"),
         "name": "Rina Wijaya, S.Pd", "role": "tutor", "phone": "081200000001", "school_id": None,
         "qualifications": ["Matematika", "Fisika", "Kimia"], "picture": None,
         "auth_provider": "password", "created_at": now_iso()},
        {"id": "proctor_demo", "email": "proktor@lms.id", "password_hash": hash_password("Proktor@12345"),
         "name": "Bapak Hendra (Proktor)", "role": "proctor", "phone": "081200000002",
         "school_id": SCHOOL1, "picture": None, "auth_provider": "password", "created_at": now_iso()},
    ])

    # Students (school 1 + school 2)
    students = [
        ("student_demo", "siswa@lms.id", "Ahmad Fauzi", SCHOOL1),
        ("student_budi", "budi@lms.id", "Budi Santoso", SCHOOL1),
        ("student_siti", "siti@lms.id", "Siti Nurhaliza", SCHOOL1),
        ("student_andi", "andi@lms.id", "Andi Pratama", SCHOOL1),
        ("student_dewi", "dewi@lms.id", "Dewi Lestari", SCHOOL1),
        ("student_rizki", "rizki@lms.id", "Rizki Ramadhan", SCHOOL2),
        ("student_maya", "maya@lms.id", "Maya Anggraini", SCHOOL2),
    ]
    await db.users.insert_many([
        {"id": sid, "email": email, "password_hash": hash_password("Siswa@12345"),
         "name": name, "role": "student", "phone": None, "school_id": school,
         "picture": None, "auth_provider": "password", "created_at": now_iso()}
        for sid, email, name, school in students
    ])

    # Courses
    courses = [
        {"id": "course_utbk", "title": "Intensif UTBK Saintek 2026", "subject": "TPS & Saintek",
         "level": "Kelas 12", "price": 750000, "active": True,
         "description": "Program persiapan UTBK lengkap dengan ribuan soal, pembahasan video, dan Try Out mingguan.",
         "thumbnail": "https://images.pexels.com/photos/9159042/pexels-photo-9159042.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
         "created_at": now_iso()},
        {"id": "course_math", "title": "Matematika Dasar & Lanjutan", "subject": "Matematika",
         "level": "Kelas 10-12", "price": 400000, "active": True,
         "description": "Kuasai konsep matematika dari dasar hingga mahir bersama tentor berpengalaman.",
         "thumbnail": None, "created_at": now_iso()},
        {"id": "course_eng", "title": "English Proficiency Bootcamp", "subject": "Bahasa Inggris",
         "level": "Umum", "price": 350000, "active": True,
         "description": "Tingkatkan skor TOEFL/IELTS dengan metode intensif dan latihan terstruktur.",
         "thumbnail": None, "created_at": now_iso()},
        {"id": "course_phys", "title": "Olimpiade Fisika", "subject": "Fisika",
         "level": "Kelas 11-12", "price": 600000, "active": True,
         "description": "Pembinaan khusus menuju kompetisi sains nasional dan internasional.",
         "thumbnail": None, "created_at": now_iso()},
    ]
    await db.courses.insert_many(courses)

    # Enrollments (school 1 students into course_utbk so tutor class has students)
    enrolls = []
    for i, sid in enumerate(["student_demo", "student_budi", "student_siti"]):
        enrolls.append({"id": f"enr_{i}", "course_id": "course_utbk", "student_id": sid,
                        "status": "active", "enrolled_at": now_iso()})
    enrolls.append({"id": "enr_math", "course_id": "course_math", "student_id": "student_demo",
                    "status": "active", "enrolled_at": now_iso()})
    await db.enrollments.insert_many(enrolls)

    # News
    await db.news.insert_many([
        {"id": "news_1", "title": "Pendaftaran Try Out Akbar 2026 Resmi Dibuka",
         "content": "Ikuti Try Out Akbar serentak se-Indonesia dengan sistem penilaian real-time dan analisis kemampuan mendetail. Kuota terbatas!",
         "category": "Pengumuman", "published": True, "author": "Administrator", "created_at": now_iso()},
        {"id": "news_2", "title": "Kerja Sama Baru dengan 5 Sekolah Mitra",
         "content": "Kami dengan bangga menyambut lima sekolah mitra baru yang bergabung dalam ekosistem pembelajaran digital kami.",
         "category": "Berita", "published": True, "author": "Administrator", "created_at": now_iso()},
        {"id": "news_3", "title": "Fitur Live Monitoring untuk Proktor Kini Tersedia",
         "content": "Proktor sekolah mitra kini dapat memantau aktivitas belajar dan menarik laporan nilai siswa secara langsung.",
         "category": "Update", "published": True, "author": "Administrator", "created_at": now_iso()},
    ])

    # Calendar
    await db.calendar_events.insert_many([
        {"id": "cal_1", "title": "Awal Semester Genap", "description": "Dimulainya kegiatan belajar semester genap.", "date": _d(5), "type": "academic", "created_at": now_iso()},
        {"id": "cal_2", "title": "Try Out Nasional Tahap 3", "description": "Try Out serentak seluruh peserta.", "date": _d(14), "type": "exam", "created_at": now_iso()},
        {"id": "cal_3", "title": "Batas Pendaftaran Kursus UTBK", "description": "Penutupan pendaftaran gelombang 1.", "date": _d(21), "type": "deadline", "created_at": now_iso()},
        {"id": "cal_4", "title": "Webinar Strategi Masuk PTN", "description": "Sesi bersama alumni.", "date": _d(28), "type": "event", "created_at": now_iso()},
        {"id": "cal_5", "title": "Libur Nasional", "description": "Hari libur kegiatan belajar.", "date": _d(35), "type": "holiday", "created_at": now_iso()},
        {"id": "cal_6", "title": "Evaluasi Tengah Program", "description": "Rapor perkembangan siswa.", "date": _d(42), "type": "academic", "created_at": now_iso()},
    ])

    # Partnership sample
    await db.partnerships.insert_one({
        "id": "part_1", "org_name": "SMA Bina Bangsa", "contact_name": "Ibu Sari",
        "email": "kerjasama@binabangsa.sch.id", "phone": "0812xxxx", "org_type": "Sekolah",
        "student_count": 120, "message": "Kami tertarik menjadi sekolah mitra.",
        "status": "new", "created_at": now_iso(),
    })

    # Teaching slots
    await db.teaching_slots.insert_many([
        {"id": "slot_math", "title": "Kelas Matematika Intensif", "subject": "Matematika",
         "date": _d(3), "start_time": "16:00", "end_time": "18:00",
         "required_qualifications": ["Matematika"], "course_id": "course_utbk", "open_to_all": False,
         "notes": "Fokus aljabar & fungsi.", "status": "open", "tutor_id": None,
         "created_by": "admin_root", "created_at": now_iso()},
        {"id": "slot_phys", "title": "Fisika Persiapan Olimpiade", "subject": "Fisika",
         "date": _d(4), "start_time": "13:00", "end_time": "15:00",
         "required_qualifications": ["Fisika"], "course_id": "course_phys", "open_to_all": False,
         "notes": "Materi mekanika lanjutan.", "status": "open", "tutor_id": None,
         "created_by": "admin_root", "created_at": now_iso()},
        {"id": "slot_chem", "title": "Kimia Dasar - Kelas UTBK", "subject": "Kimia",
         "date": _d(2), "start_time": "10:00", "end_time": "12:00",
         "required_qualifications": ["Kimia"], "course_id": "course_utbk", "open_to_all": False,
         "notes": "Stoikiometri.", "status": "confirmed", "tutor_id": "tutor_demo",
         "created_by": "admin_root", "created_at": now_iso()},
    ])
    await db.bids.insert_one({
        "id": "bid_1", "slot_id": "slot_math", "tutor_id": "tutor_demo", "tutor_name": "Rina Wijaya, S.Pd",
        "message": "Saya berpengalaman 5 tahun mengajar matematika UTBK.", "status": "pending", "created_at": now_iso(),
    })

    # Materials
    await db.materials.insert_many([
        {"id": "mat_1", "tutor_id": "tutor_demo", "title": "Rangkuman TPS Lengkap",
         "description": "Ringkasan penalaran umum, kuantitatif, dan pemahaman bacaan.",
         "content": "Bab 1: Penalaran Umum...", "file_url": None, "subject": "TPS",
         "visibility": "public", "course_id": None, "created_at": now_iso()},
        {"id": "mat_2", "tutor_id": "tutor_demo", "title": "Rumus Cepat Matematika",
         "description": "Kumpulan rumus praktis untuk mengerjakan soal dengan cepat.",
         "content": "Trik menghitung...", "file_url": None, "subject": "Matematika",
         "visibility": "public", "course_id": None, "created_at": now_iso()},
        {"id": "mat_3", "tutor_id": "tutor_demo", "title": "Latihan Soal Kelas Kimia (Privat)",
         "description": "Khusus peserta kelas UTBK.", "content": "Soal stoikiometri...", "file_url": None,
         "subject": "Kimia", "visibility": "private", "course_id": "course_utbk", "created_at": now_iso()},
    ])

    # Broadcasts to proctor page
    await db.broadcasts.insert_many([
        {"id": "bc_1", "title": "Jadwal Pengawasan Try Out Tahap 3", "priority": "high",
         "message": "Mohon proktor bersiap memantau pelaksanaan Try Out Tahap 3 pada tanggal yang telah ditentukan.",
         "author": "Administrator", "created_at": now_iso()},
        {"id": "bc_2", "title": "Pembaruan Dashboard Analitik", "priority": "normal",
         "message": "Fitur grafik tren performa siswa telah diperbarui untuk analisis yang lebih akurat.",
         "author": "Administrator", "created_at": now_iso()},
    ])

    # Try Outs + questions
    tryouts = [
        {"id": "to_1", "title": "Try Out Nasional Tahap 1", "subject": "TPS", "duration_minutes": 60,
         "description": "Simulasi ujian tahap pertama.", "start_at": _d(-30), "end_at": _d(-29),
         "published": True, "created_by": "admin_root", "created_at": now_iso()},
        {"id": "to_2", "title": "Try Out Nasional Tahap 2", "subject": "TPS", "duration_minutes": 60,
         "description": "Simulasi ujian tahap kedua.", "start_at": _d(-14), "end_at": _d(-13),
         "published": True, "created_by": "admin_root", "created_at": now_iso()},
        {"id": "to_3", "title": "Latihan Soal Campuran (Aktif)", "subject": "Umum", "duration_minutes": 30,
         "description": "Latihan soal aktif — kerjakan sekarang untuk melihat penilaian otomatis!",
         "start_at": _d(0), "end_at": _d(7), "published": True, "created_by": "admin_root", "created_at": now_iso()},
    ]
    await db.tryouts.insert_many(tryouts)
    all_q = []
    for t in tryouts:
        all_q.extend(_questions(t["id"]))
    await db.questions.insert_many(all_q)

    # Historical attempts (school 1 students) for trend analytics on to_1 and to_2
    trends = {
        "student_demo": (62, 78), "student_budi": (80, 72), "student_siti": (55, 70),
        "student_andi": (90, 86), "student_dewi": (48, 65),
    }
    attempts = []
    for sid, (a, b) in trends.items():
        for tid, pct in (("to_1", a), ("to_2", b)):
            attempts.append({
                "id": f"att_{sid}_{tid}", "tryout_id": tid, "student_id": sid,
                "status": "submitted", "answers": {}, "score": pct, "max_score": 100,
                "percentage": float(pct), "per_question": [],
                "started_at": now_iso(), "submitted_at": now_iso(), "duration_minutes": 60,
            })
    # School 2 students too (isolation demo)
    for sid, (a, b) in {"student_rizki": (70, 75), "student_maya": (60, 58)}.items():
        for tid, pct in (("to_1", a), ("to_2", b)):
            attempts.append({
                "id": f"att_{sid}_{tid}", "tryout_id": tid, "student_id": sid,
                "status": "submitted", "answers": {}, "score": pct, "max_score": 100,
                "percentage": float(pct), "per_question": [],
                "started_at": now_iso(), "submitted_at": now_iso(), "duration_minutes": 60,
            })
    await db.attempts.insert_many(attempts)

    # Attendance sample for confirmed class
    await db.attendance.insert_many([
        {"id": "att_a1", "slot_id": "slot_chem", "student_id": "student_budi", "tutor_id": "tutor_demo",
         "status": "present", "note": None, "date": _d(2), "marked_at": now_iso()},
        {"id": "att_a2", "slot_id": "slot_chem", "student_id": "student_siti", "tutor_id": "tutor_demo",
         "status": "absent", "note": "Sakit", "date": _d(2), "marked_at": now_iso()},
    ])

    await db.meta.insert_one({"key": "seed_v1", "at": now_iso()})


async def seed_content():
    """Idempotent: adds video lessons + a graded exercise to the demo course."""
    if await db.meta.find_one({"key": "seed_content_v1"}):
        return
    if not await db.courses.find_one({"id": "course_utbk"}):
        return

    await db.lessons.insert_many([
        {"id": "lesson_1", "course_id": "course_utbk", "order": 1,
         "title": "Pengenalan TPS & Strategi Mengerjakan",
         "description": "Video pembuka: memahami struktur tes dan strategi manajemen waktu.",
         "video_type": "youtube", "video_url": "https://www.youtube.com/watch?v=rfscVS0vtbw",
         "attachments": [], "created_at": now_iso()},
        {"id": "lesson_2", "course_id": "course_utbk", "order": 2,
         "title": "Trik Cepat Penalaran Kuantitatif",
         "description": "Teknik menghitung cepat untuk soal numerik.",
         "video_type": "youtube", "video_url": "https://www.youtube.com/watch?v=WUvTyaaNkzM",
         "attachments": [], "created_at": now_iso()},
    ])

    await db.tryouts.insert_one({
        "id": "ex_utbk_1", "title": "Latihan Bab 1 — Penalaran Kuantitatif", "subject": "Matematika",
        "description": "Latihan bernilai untuk mengukur pemahaman bab 1.", "duration_minutes": 15,
        "start_at": now_iso(), "end_at": None, "published": True,
        "course_id": "course_utbk", "kind": "exercise",
        "created_by": "admin_root", "created_at": now_iso(),
    })
    await db.questions.insert_many([
        {"id": "exq_1", "tryout_id": "ex_utbk_1", "order": 1, "type": "single", "points": 10,
         "text": "Hasil dari 5 × 6 adalah ...",
         "options": [{"id": "o1", "text": "30"}, {"id": "o2", "text": "35"}, {"id": "o3", "text": "25"}, {"id": "o4", "text": "36"}],
         "correct_answers": ["o1"]},
        {"id": "exq_2", "tryout_id": "ex_utbk_1", "order": 2, "type": "truefalse", "points": 10,
         "text": "Nol (0) termasuk bilangan genap.", "options": [], "correct_answers": ["true"]},
        {"id": "exq_3", "tryout_id": "ex_utbk_1", "order": 3, "type": "essay", "points": 10,
         "text": "Akar kuadrat dari 81 adalah ___ (tulis angkanya).", "options": [], "correct_answers": ["9"]},
    ])

    await db.meta.insert_one({"key": "seed_content_v1", "at": now_iso()})
