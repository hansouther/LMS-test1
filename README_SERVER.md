# Panduan Pengelolaan Server CendekiaLMS — Skala 10.000 Pengunjung Bersamaan

Dokumen ini menjelaskan **cara mengelola server** agar setiap halaman publik (landing page, `/kalender`, `/berita`) dan portal LMS mampu **diakses oleh 10.000 pengunjung dalam satu waktu (concurrent)** untuk belajar dan menggunakan aplikasi. Ditulis sebagai tutorial langkah-demi-langkah yang bisa diikuti tanpa asumsi pengetahuan mendalam.

> Ringkasan: skalabilitas dicapai lewat **caching agresif untuk konten publik**, **horizontal scaling backend**, **indeks database yang benar**, **CDN untuk aset statis & media**, dan **pemantauan (monitoring)**. Aplikasi ini sudah menyiapkan fondasi (cache-control pada endpoint publik, arsitektur stateless dengan JWT cookie, object storage untuk media) sehingga siap di-scale.

---

## 1. Memahami Beban "10.000 Pengunjung Bersamaan"

"10.000 concurrent" tidak berarti 10.000 request pada detik yang sama persis. Umumnya:

- 10.000 pengguna aktif → sekitar **500–2.000 request per detik (RPS)** pada puncak, tergantung perilaku.
- Halaman publik (landing, kalender, berita) = **mayoritas trafik, tapi datanya sama untuk semua orang** → **sangat cocok di-cache**.
- Trafik berat sebenarnya ada di **halaman login/portal** (data per-pengguna, tidak bisa di-cache).

Strategi inti:
1. **Layani halaman & data publik dari cache/CDN** → 90% trafik tidak pernah menyentuh aplikasi.
2. **Skalakan backend secara horizontal** untuk trafik dinamis (login, try out, dashboard).
3. **Optimalkan database** agar tidak jadi bottleneck.

---

## 2. Yang Sudah Disiapkan di Kode Ini

| Komponen | Status | Lokasi |
|---|---|---|
| `Cache-Control` pada endpoint publik (`/news`, `/news/{id}`, `/calendar`, `/time`, `/stats`) | ✅ Aktif (`public, max-age=60, stale-while-revalidate=300`) | `backend/routes_public.py` |
| Backend stateless (JWT httpOnly cookie, tanpa session in-memory) | ✅ | `backend/security.py` |
| Halaman publik terpisah agar mudah di-cache CDN (`/`, `/kalender`, `/berita`, `/berita/:id`) | ✅ | `frontend/src/pages/public/*` |
| Object storage untuk media kursus (video/PDF) | ✅ | `backend/storage.py`, `routes_files.py` |
| Async I/O (FastAPI + Motor) — non-blocking | ✅ | seluruh backend |

Karena backend **stateless**, kita bisa menjalankan banyak salinan (replica) di belakang load balancer tanpa masalah sesi.

---

## 3. Tutorial Langkah-demi-Langkah Pengelolaan Server

### Langkah 1 — Aktifkan CDN untuk Aset Statis Frontend

Frontend React di-build menjadi file statis (`build/`). File ini identik untuk semua pengunjung.

1. Build produksi:
   ```bash
   cd /app/frontend && yarn build
   ```
2. Sajikan folder `build/` melalui **CDN** (Cloudflare, CloudFront, Fastly) atau minimal Nginx dengan cache panjang.
3. Set header cache untuk aset ber-hash (`main.[hash].js`, `.css`, gambar):
   ```
   Cache-Control: public, max-age=31536000, immutable
   ```
   `index.html` dikecualikan (jangan di-cache lama) agar update selalu terambil:
   ```
   Cache-Control: no-cache
   ```

**Dampak:** semua JS/CSS/gambar dilayani dari edge CDN → server aplikasi nyaris tidak tersentuh untuk aset.

### Langkah 2 — Cache Konten Publik (Landing, Kalender, Berita)

Endpoint publik sudah mengirim `Cache-Control` (lihat tabel di atas). Agar efektif:

1. Letakkan **reverse proxy / CDN** di depan backend yang **menghormati header cache**.
2. Untuk Nginx, tambahkan micro-cache:
   ```nginx
   proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:100m max_size=1g inactive=5m;

   location /api/public/ {
       proxy_pass http://backend_upstream;
       proxy_cache api_cache;
       proxy_cache_valid 200 60s;                 # sesuai max-age
       proxy_cache_use_stale updating error timeout;  # tetap sajikan saat backend sibuk
       add_header X-Cache-Status $upstream_cache_status;
   }
   ```
3. Verifikasi cache bekerja:
   ```bash
   curl -I https://<domain>/api/public/news   # cek header Cache-Control & X-Cache-Status: HIT
   ```

**Dampak:** ribuan permintaan berita/kalender per detik dilayani dari cache; backend hanya diproses ~1x per 60 detik per endpoint.

### Langkah 3 — Jalankan Backend dengan Banyak Worker/Replica (Horizontal Scaling)

Satu proses FastAPI tidak cukup untuk 10k concurrent. Jalankan banyak worker:

1. Produksi dengan Gunicorn + Uvicorn workers (rumus umum: `2 × jumlah_core + 1`):
   ```bash
   gunicorn server:app \
     -k uvicorn.workers.UvicornWorker \
     -w 9 \
     --bind 0.0.0.0:8001 \
     --timeout 60 --keep-alive 15
   ```
   > Di lingkungan Emergent, service dikelola supervisor; **jangan** jalankan uvicorn manual. Untuk deploy produksi, gunakan tombol **Deploy** platform yang menangani scaling.
2. Untuk skala lebih besar, jalankan **beberapa container/replica** backend (mis. 3–5 replica) di belakang **load balancer** (Nginx/HAProxy/ALB) dengan algoritma `least_conn`.
3. Karena backend stateless (JWT cookie), request boleh mendarat di replica mana pun.

**Rumus kapasitas kasar:** 1 worker async ≈ 200–500 concurrent connection ringan. 9 worker × 3 replica ≈ puluhan ribu koneksi → cukup untuk 10k pengguna aktif.

### Langkah 4 — Optimalkan MongoDB (Database)

Database paling sering jadi bottleneck. Wajib:

1. **Buat indeks** pada field yang sering di-query (aplikasi sudah membuat indeks saat startup — lihat log `indexes ensured`). Pastikan indeks ada untuk:
   - `users.email` (unik), `users.role`
   - `news.published`, `news.created_at`
   - `calendar_events.date`
   - `attempts.user_id`, `attempts.tryout_id`
   - `lesson_progress.user_id`
2. **Connection pool** Motor — set batas agar tidak membanjiri DB:
   ```python
   AsyncIOMotorClient(MONGO_URL, maxPoolSize=100, minPoolSize=10)
   ```
3. Untuk trafik baca sangat tinggi, gunakan **MongoDB Replica Set** dan arahkan query baca ke secondary (`readPreference=secondaryPreferred`).
4. Pantau query lambat dengan MongoDB Profiler; tambahkan indeks bila ada `COLLSCAN`.

### Langkah 5 — Media (Video/PDF) Lewat Object Storage + CDN

Video pembelajaran adalah beban terbesar per-byte.

1. Semua media disimpan di **object storage** (`backend/storage.py`), bukan disk aplikasi.
2. Sajikan URL media melalui **CDN** agar streaming video tidak membebani backend.
3. Untuk file besar, gunakan **chunked upload** (sudah menjadi pola di aplikasi) dan pertimbangkan **signed URL** agar unduhan langsung dari storage.

### Langkah 6 — Rate Limiting & Proteksi

Lindungi endpoint dinamis (login, submit try out) dari lonjakan/abuse:

1. Rate limit di reverse proxy (Nginx `limit_req`) atau API gateway:
   ```nginx
   limit_req_zone $binary_remote_addr zone=login:10m rate=10r/s;
   location /api/auth/login { limit_req zone=login burst=20 nodelay; proxy_pass http://backend_upstream; }
   ```
2. Aktifkan **brute-force lockout** (sudah ada di `security.py`).
3. Aktifkan **gzip/brotli** kompresi respons di proxy untuk menghemat bandwidth.

### Langkah 7 — Monitoring, Logging, dan Auto-Scaling

Tidak bisa mengelola apa yang tidak diukur.

1. Pantau metrik: RPS, latensi p95/p99, error rate, CPU/memory per replica, koneksi DB.
2. Gunakan tools: Prometheus + Grafana, atau layanan APM (Datadog/New Relic).
3. Set **auto-scaling**: tambah replica bila CPU > 70% atau latensi p95 > 300ms; kurangi saat sepi.
4. Health check endpoint (mis. `GET /api/health`) untuk load balancer agar mengeluarkan replica yang tidak sehat.
5. Log terpusat (log aplikasi ada di `/var/log/supervisor/backend.*.log`).

### Langkah 8 — Uji Beban (Load Testing) Sebelum Puncak

Validasi kapasitas sebelum event besar (mis. try out serentak):

1. Gunakan **k6** atau **Locust**:
   ```bash
   k6 run --vus 2000 --duration 3m loadtest.js   # 2000 virtual user
   ```
2. Skenario uji: buka landing → lihat kalender → buka berita → login → mulai try out.
3. Target: p95 < 300ms untuk halaman publik, error rate < 1%.
4. Naikkan `--vus` bertahap (500 → 2000 → 5000) sambil memantau metrik, lalu tambah replica jika perlu.

---

## 4. Checklist Kesiapan 10.000 Pengunjung

- [ ] Frontend di-build produksi dan disajikan via CDN (aset ber-hash `immutable`).
- [ ] Reverse proxy/CDN meng-cache `/api/public/*` (verifikasi `X-Cache-Status: HIT`).
- [ ] Backend berjalan multi-worker + minimal 2–3 replica di belakang load balancer.
- [ ] Indeks MongoDB lengkap; connection pool diatur; pertimbangkan replica set.
- [ ] Media disajikan via object storage + CDN.
- [ ] Rate limiting & gzip/brotli aktif di proxy.
- [ ] Monitoring + alert + auto-scaling aktif; health check tersedia.
- [ ] Sudah lulus load test pada target concurrency.

---

## 5. Catatan Khusus Landing Page Publik

- **`/` (Beranda), `/kalender`, `/berita`, `/berita/:id`** murni menampilkan data publik → paling mudah di-cache. Inilah pintu masuk trafik massal dari internet.
- **Kalender** kini menampilkan grid bulanan penuh mengikuti **waktu server** (endpoint `/api/public/time`), sehingga konsisten untuk semua pengunjung dan tetap cache-friendly.
- **Berita** di beranda hanya menampilkan **judul (poin)**; isi lengkap dibuka di halaman detail `/berita/:id`. Ini mengurangi payload beranda, mempercepat load, dan menaikkan jumlah halaman ter-index mesin pencari (baik untuk SEO & jangkauan).

Untuk visibilitas maksimal (SEO), pertimbangkan lanjutan: sitemap.xml, meta tag Open Graph per berita, dan pre-render/SSR untuk halaman publik.
