# Laporan E5-c — Provisioning token (agency token + expiry)

Dokumen ini merangkum kerja yang telah dilaksanakan dalam sesi Cursor (E5-c dan susulan), untuk rujukan Claude / pembangun seterusnya.

---

## Objektif

Gantikan sistem **`provisioning_nonce`** (many nonces per agency) dengan **satu token provisioning per agensi** (`agency.agency_token`) plus **masa luput** (`agency.agency_token_expires_at`). APK imbas QR (nilai token) untuk enroll peranti. Token ialah “pass sementara”, bukan lesen kekal.

---

## Commits (Git `main`, sudah push ke `origin`)

| Commit     | Mesej |
|-----------|--------|
| `1697224` | E5-c1: replace provisioning nonce with agency token + expiry |
| `e82ae49` | E5-c2: provisioning token UI with QR code |
| `bbea846` | E5-c: allow agency admins to manage provisioning on settings page |

---

## BAHAGIAN A — Backend (E5-c1)

### Schema (`backend/prisma/schema.prisma`)

- **`agency`**: medan baharu `agency_token_expires_at DateTime? @db.Timestamp(0)` (selepas `status`).
- **Dibuang**: relasi `provisioning_nonces` pada `agency`.
- **Dibuang**: model penuh `provisioning_nonce`.

### Migration

- Perintah `npx prisma migrate dev --name e5c_provisioning_token` **gagal** kerana **drift** (DB sudah wujud tanpa sejarah migration Prisma).
- Penyelesaian yang dilaksanakan:
  1. `npx prisma db push --accept-data-loss` (jadual `provisioning_nonce` dibuang — ada 4 baris data).
  2. Fail migration ditambah: `backend/prisma/migrations/e5c_provisioning_token/migration.sql`.
  3. `npx prisma migrate resolve --applied e5c_provisioning_token`.
  4. `npx prisma generate` — OK.

### Fail dibuang

- `backend/routes/provision.js`
- Service lama `provisioning-service.js` (nonce) — **diganti** fail baharu dengan nama sama.

### Routing

- `backend/routes/index.js`: import dan `router.use('/provision', …)` **dibuang**.
- **`backend/services/provisioning-service.js` (baharu)**:
  - `generateAgencyToken(agencyId)` — token baharu + expiry; **409** jika token masih sah.
  - `endAgencyToken(agencyId)` — set `agency_token_expires_at` = now (nilai token kekal, invalid).
  - `getAgencyTokenStatus(agencyId)` — `is_valid` hanya jika ada token, ada expiry, dan expiry > now; token disembunyikan dalam respons jika tidak sah.
- TTL: `env.PROVISIONING_NONCE_TTL_MIN` (default 1440 minit) — nama env kekal walaupun nonce dibuang.

### API (`backend/routes/agencies.js`)

Asal (E5-c1): tiga route **SUPERADMIN sahaja**:

- `GET    /agencies/:id/provision-token`
- `POST   /agencies/:id/provision-token`
- `DELETE /agencies/:id/provision-token`

**Susulan (`bbea846`)**: route di atas kini:

- Middleware: **`requireAgencyAdmin`** (bukan `requireSuperadmin` sahaja).
- Semak **`canAccessAgency(req.user, agencyId)`** — admin agensi hanya agensi JWT sendiri; SUPERADMIN mana-mana agensi.

Route CRUD agensi lain kekal SUPERADMIN-only.

---

## BAHAGIAN B — Frontend (E5-c2)

### Pakej

- `qrcode@1.5.4` dalam `frontend/package.json`.

### Hook

- **Dibuang**: `frontend/src/hooks/useProvisioning.js`.
- **Baharu**: `frontend/src/hooks/useAgencyToken.js` — React Query ke `/agencies/:id/provision-token` (GET/POST/DELETE).

### UI

- **`ProvisioningPanel.jsx`**: diganti sepenuhnya — token sah → QR (`qrcode`), tarikh luput, salinan token, **End token**; tiada/luput → **Generate token**; prop **`agencyId`** wajib.
- **`AgenciesPage.jsx`**: tiada perubahan kod dalam E5-c2 (modal QR sedia ada: `<ProvisioningPanel agencyId={provisionFor.id} />`).

### E5-c2 asal — Agency Settings

- Seksyen “Device provisioning” **dibuang** dari `AgencySettingsPage.jsx` (provisioning hanya di halaman Agencies).

### Penyimpangan kecil (lint)

- Dalam `ProvisioningPanel`, baris `setQrUrl(null)` dalam `useEffect` **dibuang** untuk elak peraturan ESLint `react-hooks/set-state-in-effect` (kelakuan UI sama).

---

## Susulan sesi — Agency Settings + admin agensi

### Superadmin

- Seksyen **Device provisioning** dipulihkan pada **`AgencySettingsPage.jsx`** apabila ada agensi sasaran:
  - `agencyTargetId` = picker superadmin, atau `agencies[0]?.id` jika belum pilih.

### Admin agensi (`ADMIN_AGENCY`)

- **`provisionAgencyId`**: superadmin → `agencyTargetId`; admin agensi → `user.agency.id`.
- Panel provisioning dipaparkan bila `provisionAgencyId != null`.
- Backend dibenarkan generate/end/status untuk agensi sendiri (lihat commit `bbea846`).

---

## Logik penting untuk integrasi APK / Claude seterusnya

1. **Token sah** = `agency_token` wujud **dan** `agency_token_expires_at` wujud **dan** `agency_token_expires_at > now`.
2. Agensi lama tanpa `agency_token_expires_at` (null) → **`is_valid: false`** — perlu **Generate token** sekali dari UI.
3. **Generate** while token masih sah → HTTP **409** (“end it first”).
4. **End token** tidak kosongkan `agency_token`; hanya tamatkan expiry.
5. Endpoint provision-token berada di **`/agencies/:id/...`**, bukan `/provision/...` (route lama dibuang).
6. Peranan: **ADMIN_AGENCY+** dengan scope agensi; **SUPERADMIN** semua agensi.

---

## Fail utama disentuh (ringkasan)

**Backend:** `prisma/schema.prisma`, `prisma/migrations/e5c_provisioning_token/migration.sql`, `routes/index.js`, `routes/agencies.js`, `services/provisioning-service.js`; dipadam `routes/provision.js`.

**Frontend:** `package.json`, `hooks/useAgencyToken.js`, `components/settings/ProvisioningPanel.jsx`, `pages/settings/AgencySettingsPage.jsx`; dipadam `hooks/useProvisioning.js`.

---

## Pengesahan yang patut diulang

- [ ] Backend start tanpa ralat; tiada rujukan `provisioning_nonce` / `/provision` dalam kod.
- [ ] Superadmin: Agencies (modal QR) + Agency settings (seksyen provisioning).
- [ ] Admin agensi: Agency settings — generate, QR, end; 403 jika `:id` bukan agensi sendiri.
- [ ] `npm run lint` pada fail E5-c — lulus; projek penuh mungkin masih ada ralat ESLint lama di fail lain.

---

*Dijana untuk handoff Claude — E5-c provisioning token, Mei 2026.*
