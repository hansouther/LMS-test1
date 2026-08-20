# Tutorial Deploy Mandiri CendekiaLMS + Sizing Biaya untuk 10.000 Peserta Try Out Serentak

Dokumen ini adalah panduan **langkah demi langkah** untuk men-deploy CendekiaLMS sendiri (self-hosting) di luar Emergent, dari skala kecil sampai skala **10.000 pengguna mengerjakan Try Out secara bersamaan (concurrent)**. Termasuk **estimasi biaya server** per bulan.

> Dokumen pendamping: `README_SERVER.md` (fokus caching halaman publik). Dokumen ini fokus pada **beban dinamis berat**: login + kerjakan Try Out serentak (banyak operasi tulis ke database).

---

## 0. Arsitektur Aplikasi (yang perlu Anda deploy)

| Komponen | Teknologi | Peran |
|---|---|---|
| Frontend | React (build statis di `frontend/build`) | UI semua portal |
| Backend | FastAPI + Uvicorn/Gunicorn (`backend/`) | API `/api/*` |
| Database | MongoDB | Data utama (users, tryouts, questions, attempts, dll.) |
| Object Storage | S3/MinIO (pengganti storage Emergent) | Media kursus, CV & sertifikat tentor |
| Cache/CDN | Cloudflare/Nginx | Aset statis + konten publik |
| (Opsional) Redis | Redis | Rate limiting terdistribusi & cache |

---

## ⚠️ 1. Integrasi Emergent yang WAJIB Diganti saat Self-Hosting

Beberapa fitur saat ini memakai layanan **milik Emergent** dan **tidak akan jalan** di server sendiri tanpa diganti:

| Fitur | File | Ketergantungan Emergent | Pengganti untuk self-host |
|---|---|---|---|
| Object storage (upload CV, sertifikat, video, PDF, ZIP) | `backend/storage.py` | `integrations.emergentagent.com/objstore` + `EMERGENT_LLM_KEY` | Ganti ke **AWS S3 / MinIO** (pakai `boto3`). Ganti fungsi `put_object`/`get_object`. |
| Login Google | `frontend .../RegisterTutor.js`, `AuthCallback.jsx`, `routes_auth.py` | `auth.emergentagent.com` | Buat **Google OAuth sendiri** (Google Cloud Console → OAuth Client) atau nonaktifkan tombol Google. Login email/password JWT tetap jalan. |
| Email notifikasi (bidding, Try Out rilis, materi baru) | `backend/emailer.py` | `EMERGENT_EMAIL_KEY` (Resend terkelola) | Pakai **akun Resend sendiri** atau SMTP (SendGrid/Mailgun). |

> Login **email/password (JWT)**, CBT/Try Out, penilaian, analisis kelemahan, ekspor CSV — **semua jalan 100%** tanpa layanan Emergent. Yang perlu diganti hanya 3 hal di atas.

---

## 2. Persiapan: Ambil Kode Anda

1. Di chat Emergent, klik **“Save to GitHub”** → pilih/masukkan repo → **PUSH TO GITHUB**.
2. Clone di komputer/server Anda:
   ```bash
   git clone https://github.com/<user>/<repo>.git cendekialms
   cd cendekialms
   ```

Struktur penting: `backend/` (FastAPI), `frontend/` (React), `backend/requirements.txt`, `frontend/package.json`.

---

## 3. Environment Variables

**`backend/.env`** (jangan commit ke repo publik):
```
MONGO_URL=mongodb://<host>:27017            # atau URI MongoDB Atlas / replica set
DB_NAME=cendekialms
ADMIN_EMAIL=admin@lms.id
ADMIN_PASSWORD=<password-kuat>
CORS_ORIGINS=https://domain-anda.com
JWT_SECRET=<random-string-panjang>          # bila dipakai security.py
# Pengganti self-host (isi bila Anda ganti integrasi):
# AWS_ACCESS_KEY_ID=..., AWS_SECRET_ACCESS_KEY=..., S3_BUCKET=..., S3_REGION=...
# RESEND_API_KEY=... (atau SMTP_*)
# GOOGLE_CLIENT_ID=..., GOOGLE_CLIENT_SECRET=...
```

**`frontend/.env`**:
```
REACT_APP_BACKEND_URL=https://domain-anda.com
```
> Semua panggilan API frontend memakai `REACT_APP_BACKEND_URL`. Backend WAJIB diakses lewat prefix `/api`.

---

## 4. OPSI A — Deploy Cepat (Skala Kecil–Menengah, ratusan pengguna)

Cocok untuk uji coba / sekolah kecil. **Estimasi: $0–50/bulan.**

1. **Database** → MongoDB Atlas (free M0 512MB, atau M10 ~$9/bln).
2. **Backend** → Railway/Render:
   - Start command:
     ```bash
     gunicorn server:app -k uvicorn.workers.UvicornWorker -w 4 --bind 0.0.0.0:8001 --timeout 60
     ```
   - Set semua env `backend/.env`.
3. **Frontend** → Vercel/Netlify:
   ```bash
   cd frontend && yarn install && yarn build   # output: frontend/build
   ```
   - Set env `REACT_APP_BACKEND_URL` ke URL backend.
4. Arahkan domain + aktifkan HTTPS (otomatis di Vercel/Railway).

---

## 5. OPSI B — Deploy Skala 10.000 Peserta Try Out Serentak

### 5.1 Memahami beban ujian serentak (write-heavy)

Try Out **berbeda** dari halaman publik: datanya **tidak bisa di-cache** dan **banyak operasi tulis**. Per peserta selama ujian kira-kira:
- 1× `POST /start` (buat attempt)
- N× auto-save jawaban (bila diaktifkan) — tulis berkala
- 1× `POST /submit` (grading + tulis hasil)

**Estimasi puncak** 10.000 peserta mulai berbarengan:
- Lonjakan **start/submit** → bisa **1.000–3.000 request/detik** pada menit pembukaan & penutupan.
- Kunci sukses: **antre pembukaan (staggered start)**, **backend horizontal**, **MongoDB kuat + indeks**, dan **load balancer**.

### 5.2 Arsitektur target

```
                 Cloudflare (CDN + WAF, cache aset & /api/public)
                              │
                        Load Balancer (Nginx/HAProxy/ALB)
                       /        |        \
              App-1      App-2      App-3 ... App-N   (FastAPI, Gunicorn 4-9 worker/instance, STATELESS)
                       \        |        /
                         MongoDB Replica Set (Primary + 2 Secondary)
                         + Object Storage (S3/MinIO)  + Redis (rate limit)
```

Backend **stateless** (JWT httpOnly cookie), jadi aman di-scale horizontal — request boleh mendarat di instance mana pun.

### 5.3 Langkah deploy (contoh Docker + Nginx di VPS/cloud)

1. **Dockerize backend** (buat `backend/Dockerfile`):
   ```dockerfile
   FROM python:3.11-slim
   WORKDIR /app
   COPY requirements.txt .
   RUN pip install --no-cache-dir -r requirements.txt gunicorn
   COPY . .
   CMD ["gunicorn","server:app","-k","uvicorn.workers.UvicornWorker","-w","9","--bind","0.0.0.0:8001","--timeout","60","--keep-alive","15"]
   ```
2. **Jalankan beberapa instance** backend (mis. 4–6 kontainer) di 1+ server, atau pakai **Kubernetes / ECS / DigitalOcean App Platform** dengan **auto-scaling** (target CPU 60–70%).
3. **Load balancer Nginx** di depan (algoritma `least_conn`):
   ```nginx
   upstream backend { least_conn; server app1:8001; server app2:8001; server app3:8001; server app4:8001; }
   server {
     listen 443 ssl; server_name domain-anda.com;
     location /api/ { proxy_pass http://backend; proxy_read_timeout 60s; }
     location / { root /var/www/build; try_files $uri /index.html; }
     gzip on; gzip_types application/json text/css application/javascript;
   }
   ```
4. **Frontend**: `yarn build` → sajikan `frontend/build` via Nginx/CDN; `index.html` `no-cache`, aset ber-hash `immutable, max-age=31536000`.
5. **MongoDB Replica Set** (3 node). Di kode, set connection pool:
   ```python
   AsyncIOMotorClient(MONGO_URL, maxPoolSize=200, minPoolSize=20)
   ```
   Pastikan indeks (aplikasi sudah membuat sebagian saat startup) untuk `attempts(student_id,tryout_id)`, `questions.tryout_id`, `users.email`.
6. **Object storage**: ganti `storage.py` ke S3/MinIO + sajikan via CDN.
7. **Redis** (opsional): rate limit terdistribusi & cache konten publik.

### 5.4 Praktik wajib untuk ujian 10k serentak

1. **Staggered start** — jangan biarkan semua klik “Mulai” di detik yang sama. Buka per gelombang (mis. 2.000 peserta / menit) → memangkas puncak drastis.
2. **Auto-save jawaban** berkala (mis. tiap 30 dtk) agar tidak ada “badai submit” di akhir.
3. **Rate limiting** di proxy pada `/api/auth/login` & `/api/student/attempts/*/submit`.
4. **Monitoring** (Prometheus+Grafana / Datadog): pantau RPS, p95/p99, error rate, CPU, koneksi Mongo.
5. **Load test WAJIB** sebelum hari-H (lihat bagian 7).

---

## 6. 💰 Estimasi Biaya Server untuk 10.000 Peserta Try Out Serentak

> **Catatan:** angka di bawah adalah **estimasi pasar (USD/bulan)** dan bisa berubah — selalu cek langsung ke penyedia. Biaya dihitung untuk **beban puncak saat ujian**; di luar jam ujian biaya bisa jauh lebih murah bila memakai **auto-scaling** (matikan instance ekstra saat sepi).

### 6.1 Rincian komponen (rekomendasi)

| Komponen | Spesifikasi rekomendasi | Estimasi USD/bulan |
|---|---|---|
| App servers (FastAPI) | 4–6 instance @ 4 vCPU / 8 GB (auto-scale) | $150 – $500 |
| Load balancer | Managed LB (ALB / DO LB) | $10 – $30 |
| MongoDB | Atlas **M40–M50** (16–32 GB RAM, replica set) atau 3 node self-managed | $400 – $1.000 |
| Redis (cache/rate-limit) | 1–2 GB managed | $15 – $50 |
| Object storage + bandwidth | S3 + CDN (tergantung volume video) | $20 – $150 |
| CDN (Cloudflare) | Free–Pro | $0 – $20 |
| Monitoring | Grafana Cloud/Datadog (tier kecil) | $0 – $100 |
| **TOTAL (puncak)** | | **≈ $600 – $1.850 / bulan** |

**Dalam Rupiah (kurs ±Rp16.000):** sekitar **Rp10 juta – Rp30 juta / bulan** pada beban puncak penuh.

### 6.2 Cara menekan biaya (sangat disarankan)

- **Bayar per jam & auto-scale**: nyalakan armada penuh **hanya saat ujian berlangsung** (mis. 4 jam). Jika ujian 8 hari/bulan × 4 jam, biaya efektif bisa turun **70–85%** → realistis **$150 – $400/bulan**.
- **Try Out bergelombang** (staggered) → butuh lebih sedikit server untuk RPS puncak yang sama.
- Mulai dari **Atlas M30** (~$200) + 3 app instance, lalu naikkan setelah hasil load test.

### 6.3 Contoh paket hemat (event-based)

| Skenario | Konfigurasi | Estimasi |
|---|---|---|
| Kecil (≤1.000 serentak) | 2 app @2vCPU, Atlas M20, Cloudflare free | ~$80–150/bln |
| Menengah (≤5.000 serentak) | 3–4 app @4vCPU, Atlas M30, Redis | ~$300–500/bln |
| Besar (10.000 serentak, auto-scale) | 4–6 app @4vCPU + LB + Atlas M40/M50 + Redis + CDN | ~$600–1.850/bln puncak (bisa ~$150–400 dgn auto-scale) |

---

## 7. Load Testing (WAJIB sebelum hari-H)

Gunakan **k6** untuk mensimulasikan skenario ujian nyata:
```bash
k6 run --vus 5000 --duration 5m loadtest_tryout.js
```
Skenario yang diuji: login → buka daftar Try Out → `POST /start` → beberapa auto-save → `POST /submit`.
Target: **p95 < 500 ms**, **error rate < 1%**. Naikkan bertahap 1.000 → 3.000 → 5.000 → 10.000 VUs sambil memantau; tambah app instance / naikkan tier MongoDB bila p95 melonjak atau muncul `COLLSCAN`/antrean koneksi.

---

## 8. Checklist Kesiapan Hari-H

- [ ] Integrasi Emergent (storage, Google Auth, email) sudah diganti/dites di lingkungan self-host.
- [ ] Frontend build produksi via CDN; `REACT_APP_BACKEND_URL` benar.
- [ ] Backend multi-instance di belakang load balancer; health check aktif.
- [ ] MongoDB replica set + indeks + connection pool.
- [ ] Rate limiting + gzip aktif; HTTPS aktif; `CORS_ORIGINS` benar.
- [ ] Monitoring + alert + auto-scaling siap.
- [ ] Sudah lulus load test pada target concurrency (idealnya 1.2× target).
- [ ] Rencana **staggered start** & **auto-save** untuk hari ujian.
- [ ] Backup MongoDB terjadwal.

---

### Ringkasan singkat
- **Paling mudah:** Deploy di Emergent (tombol Deploy) — cocok untuk skala kecil–menengah.
- **Self-host kecil:** Vercel + Railway/Render + Atlas → **$0–50/bln**.
- **Self-host 10k serentak:** VPS/cloud + load balancer + MongoDB kuat + auto-scaling → **±$600–1.850/bln puncak** (bisa ditekan ke **$150–400/bln** dengan auto-scale event-based). **Wajib** ganti 3 integrasi Emergent + load test.
