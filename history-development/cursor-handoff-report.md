# Handoff Cursor → Claude — LoRa Mesh Pro (claude repo)

Dokumen ringkasan kerja yang dilaksanakan dalam sesi Cursor (E5-c dan susulan), termasuk perubahan yang **mungkin belum di-commit**. Untuk rujukan Claude / pembangun seterusnya.

**Repo:** `mesh_pro_claude` · branch `main` (terakhir push: commit `bbea846` — lihat bahagian Git di bawah).

---

## 1. E5-c — Provisioning token (ringkas)

Gantikan **`provisioning_nonce`** dengan **satu token per agensi** + **`agency_token_expires_at`**.

| Commit (sudah push) | Mesej |
|---------------------|--------|
| `1697224` | E5-c1: replace provisioning nonce with agency token + expiry |
| `e82ae49` | E5-c2: provisioning token UI with QR code |
| `bbea846` | E5-c: allow agency admins to manage provisioning on settings page |

**API:** `GET|POST|DELETE /api/agencies/:id/provision-token`  
- Peranan: **`requireAgencyAdmin`** + **`canAccessAgency`** (admin agensi = agensi sendiri; superadmin = mana-mana).  
- Service: `backend/services/provisioning-service.js` (`generateAgencyToken`, `endAgencyToken`, `getAgencyTokenStatus`).  
- Token sah ↔ `agency_token` + `agency_token_expires_at > now`.  
- Route lama **`/api/provision`** dan model **`provisioning_nonce`** — **dibuang**.

**UI:** `ProvisioningPanel` + hook `useAgencyToken.js` + `qrcode@1.5.4`.  
- **Agencies** (superadmin): modal QR per baris.  
- **Agency settings:** superadmin (agensi dipilih / default pertama) **dan** admin agensi (`user.agency.id`).

Butiran penuh: [`E5-c-provisioning-token-report.md`](./E5-c-provisioning-token-report.md).

---

## 2. Migration DB (E5-c1)

- `prisma migrate dev` gagal (**drift** — DB wujud tanpa sejarah migration).
- Dilaksanakan: `db push --accept-data-loss`, fail `backend/prisma/migrations/e5c_provisioning_token/migration.sql`, `migrate resolve --applied`.

---

## 3. Frontend — pecahan bundle (chunk)

**Masalah asal:** satu chunk `index` ~1.2 MB + maplibre ~1 MB.

**Perubahan:**

| Fail | Apa |
|------|-----|
| `frontend/vite.config.js` | `manualChunks` (map, calendar, qrcode, react, query, socket, utils, vendor); `chunkSizeWarningLimit: 1100` |
| `frontend/src/App.jsx` | `React.lazy` + `Suspense` untuk layout/halaman (Map, Historical, Settings, Login, dll.) |
| `frontend/src/lib/deviceTypeIcons.js` | **Baharu** — ikon named Lucide untuk `device_type.icon` |
| `frontend/src/map/DeviceMarker.jsx` | Buang `import * as LucideIcons` (~600 kB+) |

**Hasil build (anggaran):** entry `index` ~9 kB gzip ~3 kB; `map-vendor` ~1 MB **h hanya** route peta/historical; `vendor` ~20 kB selepas fix Lucide.

**Nota:** Tambah ikon jenis peranti baharu dalam `deviceTypeIcons.js` jika DB guna nama Lucide baru.

---

## 4. Backend — UI statik + SPA (satu port)

**Matlamat:** build frontend ke **`backend/public`**, Express hidupkan statik + fallback supaya **reload** deep link React Router (cth. `/settings/agency`) berfungsi.

| Fail | Apa |
|------|-----|
| `backend/public/` | Output Vite; `.gitkeep` bila kosong |
| `frontend/vite.config.js` | `outDir: ../backend/public`, `emptyOutDir: true`, `base: '/'` |
| `backend/server.js` | `express.static(publicDir)` jika `index.html` wujud; `GET/HEAD *` (bukan `/api`) → `index.html` |
| `backend/package.json` | Skrip `"build:ui": "npm run build --prefix ../frontend"` |
| `.gitignore` | `backend/public/*` kecuali `!backend/public/.gitkeep` |
| `frontend/src/lib/api.js` | Production tanpa `VITE_API_URL` → base **`/api`** (same origin) |
| `frontend/src/lib/socket.js` | Production tanpa `VITE_SOCKET_URL` → same host (default `io()`) |
| `frontend/.env.example` | Komen untuk production same-origin |

**Aliran deploy:**

```bash
cd frontend && npm run build    # atau: cd backend && npm run build:ui
cd backend && npm start         # NODE_ENV=production
```

**Dev:** kekal Vite `:5173` + backend `:5001`; `.env` frontend `VITE_API_URL=http://localhost:5001`.

---

## 5. Status Git (semasa dokumen ditulis)

**Sudah push (`origin/main`):** sehingga `bbea846` (E5-c provisioning + admin agensi).

**Belum commit (working tree):** antara lain:

- `.gitignore`, `backend/server.js`, `backend/package.json`
- `frontend/vite.config.js`, `frontend/src/App.jsx`, `deviceTypeIcons.js`, `DeviceMarker.jsx`
- `frontend/src/lib/api.js`, `frontend/src/lib/socket.js`, `frontend/.env.example`
- `history-development/` (laporan)
- Fail lain yang mungkin disentuh berasingan: `SettingsSidebar.jsx`, `TopBar.jsx`, `MapTopOverlay.jsx`, padam `HANDOFF.md`

Claude patut **`git status` / `git diff`** sebelum teruskan kerja.

---

## 6. Semak pantas (QA)

- [ ] `npm run build` frontend → fail dalam `backend/public/`
- [ ] Backend dengan `public/index.html`: `/` UI, `/settings/agency` reload → 200 + HTML root
- [ ] `/api/health/ping` (atau health sedia ada) masih JSON
- [ ] Provisioning: superadmin + admin agensi generate/QR/end
- [ ] Dev mode masih berfungsi dengan `VITE_API_URL`

---

## 7. Fail utama (indeks)

**Backend:** `prisma/schema.prisma`, `routes/agencies.js`, `services/provisioning-service.js`, `server.js`, `public/`  
**Frontend:** `App.jsx`, `vite.config.js`, `hooks/useAgencyToken.js`, `components/settings/ProvisioningPanel.jsx`, `pages/settings/AgencySettingsPage.jsx`, `lib/deviceTypeIcons.js`, `lib/api.js`, `lib/socket.js`

---

*Handoff Cursor — Mei 2026. Kemas kini selepas commit chunk + SPA jika perlu.*
