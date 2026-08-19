# PRD — CendekiaLMS (LMS RBAC, 5 Portal)

## Problem Statement (original)
Bangun platform Learning Management System (LMS) berbasis Role-Based Access Control dengan 5 portal terintegrasi: Landing Publik, Dashboard Siswa, Dashboard Admin, Dashboard Tentor, Dashboard Proktor. Deliverable: arsitektur, skema DB (ERD), alur data (Admin buat soal → Proktor lihat nilai), strategi auth & keamanan antar 5 role, lalu aplikasi fungsional.

## User Choices
- Auth: JWT email/password untuk 5 role + Google login (siswa). Sistem sesi terpadu (Google→JWT internal).
- CBT auto-grading: pilihan ganda, pilihan ganda kompleks, benar/salah, esai (cocok teks, case-insensitive).
- Tanpa integrasi pihak ketiga lain di tahap awal.
- Warna: "Intelligent & Comfortable" (Intellect Blue #4361EE, Vivid Amber #FF9F1C, latar Soft Slate).
- Output: dokumen arsitektur + aplikasi end-to-end + fondasi bertahap dari Admin.

## Architecture
- Frontend: React 19 + React Router 7, Tailwind, shadcn/ui, Recharts, Framer Motion. Fonts: Outfit/DM Sans/JetBrains Mono.
- Backend: FastAPI + Motor (async MongoDB). Modular routers per role (auth/public/admin/student/tutor/proctor).
- DB: MongoDB (UUID string `id`, selalu project `{_id:0}`).
- Auth: JWT httpOnly cookies (access 24h / refresh 7d), bcrypt, brute-force lockout, RBAC via `require_roles`.
- Dokumen arsitektur lengkap: `/app/ARCHITECTURE.md`.

## Personas
- Publik/Calon mitra, Siswa, Admin (pusat kendali), Tentor, Proktor (pemantau sekolah mitra).

## Core Requirements (static)
- Landing: panduan, value prop, kalender akademik, form kemitraan, berita.
- Siswa: ruang belajar (materi publik/privat), CBT/Try Out, katalog & pendaftaran kursus, jadwal.
- Admin: CMS berita & kalender, kursus & jadwal, job-bidding, bank soal + kunci + timing + skor, broadcast, kemitraan, pengguna & sekolah.
- Tentor: job bidding (cek kualifikasi), kalender pribadi, presensi, unggah materi publik/privat.
- Proktor: live monitoring, laporan nilai (CSV), analitik tren — terbatas sekolahnya (isolasi multi-tenant).

## Implemented (2026-08-19)
- Semua 5 portal fungsional end-to-end. Auth JWT + Google, RBAC diberlakukan.
- CBT engine (timer, navigasi soal, 4 tipe soal) + penilaian otomatis + halaman hasil & pembahasan.
- Admin: TryoutBuilder (4 tipe soal + kunci), assignment job-bidding (slot open→confirmed), semua CRUD.
- Tutor: bidding, kalender, presensi, materi.
- Proktor: dashboard, live monitoring (polling 10s), analitik (bar + multi-line trend, recharts), laporan + unduh CSV. Isolasi sekolah terverifikasi.
- Seed data demo lengkap (users semua role, kursus, 3 tryout + soal, slot/bids, berita, kalender, broadcast, attempts historis untuk analitik).
- Testing: 38/38 backend PASS; seluruh flow frontend kritis PASS (iteration_1.json). Tidak ada bug.

## Backlog / Next (P1/P2)
- P1: Retake/multiple attempt & bank soal impor massal; timer server-side enforcement.
- P1: Notifikasi email (Resend) untuk pengumuman & konfirmasi bidding.
- P2: Pembayaran kursus (Stripe/Razorpay); upload file materi (object storage).
- P2: WebSocket untuk live monitoring real-time (saat ini polling).
- P2: Lifespan handler menggantikan on_event; body model untuk update partnership.

## Test Credentials
Lihat `/app/memory/test_credentials.md`.
