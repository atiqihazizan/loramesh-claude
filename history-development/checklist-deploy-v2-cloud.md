# Checklist deploy v2 ke cloud (lora2u.com) — tanpa clash API v1

**Server:** `mahsites` (`root@mahsites`)  
**Path v2:** `/var/www/loramesh/mesh_v2/`  
**Path v1 (legacy):** `/var/www/loramesh/mesh/` — PM2 `lora2u` :5001  
**Domain:** `https://lora2u.com`

Rujukan nginx penuh: [`nginx-v1-v2-api-split.md`](./nginx-v1-v2-api-split.md)

---

## Keadaan semasa (Mac 2026)

- [ ] Sahkan: v2 **dimatikan sementara** untuk uji v1 (nginx v2 dikomen, `mesh_v2` stopped) — **normal** sebelum checklist ini.
- [ ] Selesai uji v1 di `https://lora2u.com/` — OK / tidak OK (catat).

---

## A. Sebelum deploy (repo & mesin dev)

- [ ] Pull / commit kod terkini (termasuk `api.js`, `socket.js`, `baseUrl.js` — API prod = `/v2/api`).
- [ ] `frontend/.env` untuk **build production**:
  - [ ] `VITE_APP_BASE=/v2/`
  - [ ] `VITE_API_URL=` **kosong** (padam atau `#` comment)
  - [ ] `VITE_SOCKET_URL=` **kosong**
- [ ] Build UI:
  ```bash
  cd frontend && npm ci && npm run build
  ```
- [ ] Semak bundle **tiada** `localhost:5002`:
  ```bash
  grep -r 'localhost:5002' ../backend/public/assets/ || echo "OK — tiada localhost"
  ```
- [ ] (Opsyen) Uji local production-like:
  ```bash
  cd backend && NODE_ENV=production PORT=5002 npm start
  ```
  Buka UI ikut setup dev; API dev masih `http://localhost:5002/api` (bukan `/v2/api`).

---

## B. Sandaran server (wajib)

- [ ] SSH `root@mahsites`
- [ ] Buat folder sandaran:
  ```bash
  mkdir -p /var/www/loramesh/backup/$(date +%Y-%m-%d)
  ```
- [ ] Sandaran:
  - [ ] `/etc/nginx/sites-available/loramesh.conf`
  - [ ] `/var/www/loramesh/mesh_v2/.env`
  - [ ] `/var/www/loramesh/mesh_v2/public/` (tar atau cp -a)
  - [ ] (Opsyen) `mysqldump` DB `lora_mesh_pro` jika ada migration baru

---

## C. Backend v2 di server

- [ ] Sync kod backend ke `/var/www/loramesh/mesh_v2/` (git pull / rsync — ikut cara anda biasa).
- [ ] Semak `.env` **mesh_v2**:
  - [ ] `PORT=5002`
  - [ ] `NODE_ENV=production`
  - [ ] `API_BASE_URL=https://lora2u.com`
  - [ ] `DATABASE_URL=...` (DB `lora_mesh_pro`)
  - [ ] `CORS_ORIGIN` termasuk `https://lora2u.com`, `https://www.lora2u.com`
- [ ] `npm ci` (atau `npm install`) dalam `mesh_v2` jika package berubah.
- [ ] Prisma (jika ada migration baru): `db push` / `migrate deploy` / `generate` — ikut [`deployment-and-baseurl-report.md`](./deployment-and-baseurl-report.md) §4.5.
- [ ] Restart backend:
  ```bash
  pm2 start mesh_v2
  # atau: pm2 restart mesh_v2
  pm2 save
  ```
- [ ] Uji **langsung** pada server (bypass nginx):
  ```bash
  curl -sS http://127.0.0.1:5002/api/health/ping
  ```
  - [ ] Jawapan JSON `ok: true`

---

## D. Frontend v2 di server

- [ ] Sync hasil build `backend/public/` → `/var/www/loramesh/mesh_v2/public/`
- [ ] Semak `index.html` rujuk `/v2/assets/...` (bukan `/assets/` sahaja di root).
- [ ] Semak sekali lagi di server:
  ```bash
  grep -l 'localhost:5002' /var/www/loramesh/mesh_v2/public/assets/*.js && echo "GAGAL — rebuild" || echo "OK"
  ```

---

## E. Nginx — pisah v1 / v2 (paling penting)

Edit `/etc/nginx/sites-available/loramesh.conf` (server block `lora2u.com`):

- [ ] **Ada** static `/v2/` → `mesh_v2/public`
- [ ] **Ada** `location ^~ /v2/api/` → `proxy_pass http://127.0.0.1:5002/api/;`
- [ ] **Ada** `location ^~ /v2/socket.io/` → `proxy_pass http://127.0.0.1:5002/socket.io/;` (+ header WebSocket)
- [ ] **Ada** `location ^~ /api/` → **5001** (v1)
- [ ] **Ada** `location ^~ /socket.io/` → **5001** (jika v1 guna same-origin; jika v1 hanya guna `socketio.lora2u.com`, boleh kekal subdomain ke 5001/5002 ikut doc lama)
- [ ] **Tiada** rule lama: `location ^~ /api/` → **5002** pada domain utama
- [ ] **Buang / jangan guna** `location ^~ /assets/` di root untuk v2 (asset v2 di `/v2/assets/`)
- [ ] `location /` → **5001** (legacy UI)
- [ ] Uji & reload:
  ```bash
  nginx -t && systemctl reload nginx
  ```

---

## F. Ujian selepas deploy (browser + curl)

Jalankan dari laptop atau server:

| Ujian | URL / arahan | Jangka |
|-------|----------------|--------|
| v1 UI | `https://lora2u.com/` | 200, login v1 OK |
| v1 API | `POST https://lora2u.com/api/auth/login` (body invalid) | 400/401 — **bukan** connection refused |
| v2 UI | `https://lora2u.com/v2/` | 200, asset load |
| v2 API | `https://lora2u.com/v2/api/health/ping` | 200 JSON `ok: true` |
| v2 **jangan** guna | `https://lora2u.com/api/health/ping` | v1 atau 404 — **bukan** satu-satunya pintu v2 |
| v2 off-path | DevTools Network semasa login v2 | Request ke **`/v2/api/...`**, bukan `localhost:5002` |

- [ ] Login v2 di `/v2/login`
- [ ] Map / realtime (Socket) v2 — tiada error WebSocket ke path salah
- [ ] v1 masih OK selepas v2 hidup (regression)

---

## G. Rollback pantas (jika rosak)

- [ ] Restore nginx dari sandaran:
  ```bash
  cp /var/www/loramesh/backup/YYYY-MM-DD/loramesh.conf.before-* /etc/nginx/sites-available/loramesh.conf
  nginx -t && systemctl reload nginx
  ```
- [ ] `pm2 stop mesh_v2` (kekal v1 sahaja)
- [ ] Restore `public/` dari sandaran jika perlu

---

## H. Selepas berjaya

- [ ] `pm2 save`
- [ ] Catat tarikh deploy + commit hash repo dalam nota dalaman
- [ ] Kemas kini [`deployment-and-baseurl-report.md`](./deployment-and-baseurl-report.md) jika ada perubahan env/nginx

---

## Ringkasan satu baris

**Deploy v2 = nginx (`/v2/api` → 5002, `/api` → 5001) + build UI tanpa `localhost` + sync `public/` + `pm2 start mesh_v2` — bukan salah satu sahaja.**
