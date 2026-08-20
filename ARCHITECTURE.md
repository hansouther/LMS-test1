# Binara LMS — Rancangan Arsitektur Sistem (LMS berbasis RBAC)

Dokumen ini merangkum arsitektur sistem, skema database (ERD), alur data, dan strategi keamanan untuk platform LMS dengan 5 portal terintegrasi: **Landing Publik, Siswa, Admin, Tentor, Proktor**.

---

## 1. Rekomendasi Tech Stack

| Lapisan | Teknologi | Alasan |
|---|---|---|
| Frontend | **React 19 + React Router 7**, Tailwind CSS, shadcn/ui, Recharts, Framer Motion | Komponen kaya, aman, cepat; grafik analitik & animasi halus |
| Backend | **FastAPI (Python)** + Motor (async MongoDB driver) | Async, validasi Pydantic, cocok untuk API `/api` ber-role |
| Database | **MongoDB** | Fleksibel untuk bank soal dinamis (soal beragam tipe) & relasi longgar |
| Auth | **JWT (httpOnly cookie)** untuk 5 peran + **Google OAuth** (Emergent-managed) untuk siswa | Sesi aman, bebas XSS token, kombinasi login |
| Hashing | **bcrypt** | Standar industri untuk password |
| Deploy | Kubernetes ingress (`/api` → backend:8001, sisanya → frontend:3000) | Pemisahan rute otomatis |

Prinsip keamanan stack: seluruh URL/kredensial dari environment variable, cookie `httpOnly + Secure + SameSite`, CORS origin eksplisit.

---

## 2. Skema Database (Koleksi Utama & Relasi)

Semua dokumen memakai `id` (UUID string) sebagai primary key aplikasi (bukan `_id` Mongo).

### users
`id, email(unik), password_hash, name, role[admin|student|tutor|proctor], phone, school_id→schools.id, qualifications[], picture, auth_provider, created_at`

### schools (sekolah mitra)
`id, name, city, created_at`  → dirujuk oleh `users.school_id` (siswa & proktor)

### news / calendar_events / partnerships (Landing Publik, dikelola Admin)
- news: `id, title, content, category, published, author, created_at`
- calendar_events: `id, title, description, date, type, created_at`
- partnerships: `id, org_name, contact_name, email, phone, org_type, student_count, message, status, created_at`

### courses & enrollments (katalog + pendaftaran)
- courses: `id, title, description, subject, level, price, thumbnail, active, created_at`
- enrollments: `id, course_id→courses.id, student_id→users.id, status, enrolled_at`

### teaching_slots & bids (JADWAL — inti relasi Admin↔Tentor↔Siswa)
- teaching_slots: `id, title, subject, date, start_time, end_time, required_qualifications[], course_id→courses.id, open_to_all, status[open|confirmed], tutor_id→users.id, created_by, notes, created_at`
- bids: `id, slot_id→teaching_slots.id, tutor_id→users.id, tutor_name, message, status[pending|accepted|rejected], created_at`

### attendance & materials (Manajemen Kelas Tentor)
- attendance: `id, slot_id→teaching_slots.id, student_id→users.id, tutor_id→users.id, status[present|late|absent], note, date, marked_at`
- materials: `id, tutor_id→users.id, title, description, content, file_url, subject, visibility[public|private], course_id→courses.id, created_at`

### tryouts, questions, attempts (NILAI — inti relasi Admin↔Siswa↔Proktor)
- tryouts: `id, title, description, subject, duration_minutes, start_at, end_at, published, created_by, created_at`
- questions: `id, tryout_id→tryouts.id, type[single|multiple|truefalse|essay], text, options[{id,text}], correct_answers[], points, order`
- attempts: `id, tryout_id→tryouts.id, student_id→users.id, status[in_progress|submitted], answers{qid:[..]}, score, max_score, percentage, per_question[], started_at, submitted_at`

### broadcasts (Admin → Proktor)
`id, title, message, priority[normal|high], author, created_at`

### Diagram Relasi (ringkas)
```
schools 1──* users(students, proctors)
users(admin) ──creates──> courses, tryouts, teaching_slots, news, calendar, broadcasts
courses 1──* enrollments *──1 users(student)
teaching_slots 1──* bids *──1 users(tutor)         [JOB BIDDING]
teaching_slots(confirmed).tutor_id ──> users(tutor) [KALENDER TENTOR]
teaching_slots ──> attendance <── users(student)
tryouts 1──* questions
tryouts 1──* attempts *──1 users(student)
users(student).school_id ── users(proctor).school_id  [ISOLASI DATA PROKTOR]
```

---

## 3. Alur Data: dari Admin membuat soal → Proktor melihat nilai

1. **Admin** membuat `tryout` (judul, durasi) lalu menambah `questions` beserta `correct_answers` (kunci) via TryoutBuilder → set `published=true`.
2. **Siswa** melihat tryout terbit → `POST /student/tryouts/{id}/start` membuat `attempt` (status `in_progress`).
3. Siswa mengerjakan (timer) → `POST /student/attempts/{id}/submit` mengirim `answers`.
4. **Backend menilai otomatis** (`grading.py`):
   - `single`: 1 opsi cocok kunci · `multiple`: himpunan opsi = kunci (exact) · `truefalse`: benar/salah · `essay`: cocok teks (case-insensitive, trim).
   - Menghitung `score`, `max_score`, `percentage`, `per_question` → simpan ke `attempt` (status `submitted`).
5. **Admin** melihat peringkat via `GET /admin/tryouts/{id}/results`.
6. **Proktor** membuka `GET /proctor/reports` & `/proctor/analytics`. Backend memfilter `attempts` hanya untuk siswa dengan `school_id == proctor.school_id` → tampilkan tabel nilai, unduh CSV, dan grafik tren performa.

**Alur jadwal (paralel):** Admin buka `teaching_slot` (open) → Tentor `bid` (dicek kualifikasi) → Admin `assign` bid → slot jadi `confirmed` + `tutor_id` terisi → muncul di Kalender Tentor & Jadwal Siswa (via `course_id`) → Tentor melakukan presensi (`attendance`).

---

## 4. Strategi Autentikasi & Keamanan Antar-5 Role

- **Autentikasi**: JWT access token (24 jam) + refresh token (7 hari) disimpan sebagai cookie `httpOnly, Secure, SameSite=None`. Google OAuth (siswa) memverifikasi identitas lalu diterbitkan JWT internal yang sama → satu sistem sesi terpadu.
- **Otorisasi (RBAC)**: dependency `require_roles(...)` pada setiap router memblokir akses lintas peran (HTTP 403). Prefix rute per peran: `/api/admin`, `/api/student`, `/api/tutor`, `/api/proctor`, publik di `/api/public`.
- **Isolasi multi-tenant (Proktor)**: setiap query proktor difilter `school_id` sehingga proktor hanya melihat siswa sekolahnya — tidak bisa mengakses data sekolah lain.
- **Kerahasiaan kunci jawaban**: endpoint siswa `strip_answers()` menghapus `correct_answers` sebelum soal dikirim ke klien; penilaian hanya di server.
- **Proteksi kredensial**: password di-hash bcrypt; brute-force lockout (5 percobaan / 15 menit) via koleksi `login_attempts`; email unik terindeks.
- **Boundary lain**: validasi input via Pydantic, CORS origin eksplisit dari env, admin seeding idempoten, tidak ada nilai/kredensial yang di-hardcode.

---

## 5. Ringkasan Peran & Kapabilitas

| Peran | Akses Utama |
|---|---|
| Publik | Landing: panduan, kalender, berita, form kemitraan |
| Siswa | Ruang belajar (materi publik/privat), CBT/Try Out, katalog & pendaftaran kursus, jadwal |
| Admin | CMS landing, kursus & jadwal, job-bidding, bank soal & nilai, broadcast, pengguna & sekolah |
| Tentor | Job bidding, kalender pribadi, presensi, unggah materi (publik/privat) |
| Proktor | Live monitoring, laporan nilai (CSV), analitik tren — terbatas sekolahnya |
