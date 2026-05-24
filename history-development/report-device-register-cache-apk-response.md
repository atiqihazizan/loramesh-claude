# Laporan: Baiki Register Device (Cache 401 + Bentuk Response APK)

**Repo:** mesh_pro_claude (v3)  
**Tarikh laporan:** 2026-05-24  
**Skop:** `backend/` — pendaftaran peranti self-service (APK Flutter / modbus_go)

---

## 1. Ringkasan masalah

APK berjaya imbas QR provisioning, tetapi `POST /api/devices-user/register` gagal atau data tidak boleh dibaca oleh klien.

| Punca | Gejala | Akar masalah |
|-------|--------|--------------|
| **A — Cache agency** | HTTP **401** `Invalid agency token` dengan token baru | Token ditulis ke DB oleh provisioning, tetapi cache in-memory (`loadAgencyCache` masa start) tidak dikemas kini |
| **B — Bentuk JSON** | Register mungkin 200/201 tetapi APK gagal parse | v3 pulangkan `device.device_id` + `agency` bersarang; APK expect `device.deviceid` + `agency_token` / `agency_id` / `agency_name` di top-level |

Logik pendaftaran (device baru → `need_approval` + notifikasi; re-scan → tiada daftar semula) **tidak diubah** dalam fix ini.

---

## 2. Penyelesaian yang dilaksanakan

### 2.1 TASK A — Refresh cache selepas token provisioning

**Fail:** `backend/services/provisioning-service.js`

- Import: `refreshAgencyInCache` dari `../lib/cache/agency-cache.js`
- Selepas `prisma.agency.update` berjaya:
  - **`generateAgencyToken(agencyId)`** → `await refreshAgencyInCache(agencyId)`
  - **`endAgencyToken(agencyId)`** → `await refreshAgencyInCache(agencyId)`

Kesan: token baru dari panel admin boleh digunakan oleh middleware `authenticateAgencyToken` **tanpa restart PM2/node**.

**Fail:** `backend/services/agency-service.js` — **tiada perubahan** (sudah betul sebelum fix):

| Fungsi | Cache |
|--------|--------|
| `createAgency` | `refreshAgencyInCache(result.agency.id)` |
| `updateAgency` | `refreshAgencyInCache(id)` |
| `rotateAgencyToken` | `refreshAgencyInCache(id)` |
| `disableAgency` | `removeAgencyFromCache(id)` |

**Tidak diubah:** `middleware/auth-agency-token.js`, `lib/cache/agency-cache.js`.

### 2.2 TASK B — Response `POST /api/devices-user/register`

**Fail:** `backend/services/device-register-service.js` (`registerDevice`), route `backend/routes/devices-user.js`.

**Request body:**

- Medan wajib: `name` + **`deviceid` atau `device_id`** (`const id = device_id || deviceid`)
- Header/token: `x-agency-token` (atau Bearer / body / query — ikut middleware)

**Response (contoh device baru):**

```json
{
  "success": true,
  "device": {
    "deviceid": "<devices.device_id>",
    "device_id": "<devices.device_id>",
    "name": "<devices.name>",
    "need_approval": true
  },
  "agency_id": 2,
  "agency_name": "<agency.name>",
  "agency_token": "<token dari req.agency.token>",
  "is_new": true,
  "need_approval": true
}
```

**HTTP status:**

- **201** jika `is_new === true`
- **200** jika re-scan (`is_new === false`)

### 2.3 TASK C — Response `GET /api/devices-user/check/:deviceid`

Endpoint **PUBLIC** (tiada middleware agency token).

**Device wujud:**

```json
{
  "exists": true,
  "device": {
    "deviceid": "<devices.device_id>",
    "name": "<devices.name>",
    "need_approval": true,
    "date_approved": null,
    "agency_id": 2,
    "agency_name": "<agency.name>",
    "agency_token": "<agency.agency_token dari device_agency aktif>",
    "last_known": { "...": "snapshot live_tracking atau null" }
  }
}
```

**Device tiada:** `{ "exists": false, "device": null }`

`agency_token` dari join `device_agency` (active) → `agency`, supaya APK boleh pulih token selepas reinstall.

### 2.4 TASK D — Sahkan logik teras (unchanged)

Disahkan kekal dalam `device-register-service.js`:

1. **Device baru:** `devices` (`need_approval: true`, `status: 'offline'`), `device_agency` (active), `device_log` (`assignment`).
2. **Selepas transaksi:** `assignDeviceToAgencyInCache` / unassign jika transfer; `notifyDevicePending` dalam try/catch **hanya** bila `is_new`.
3. **Re-scan:** tidak ubah `need_approval` / `date_approved`; kemas kini `name` jika berbeza; pastikan `device_agency.active = true`; tiada notifikasi pending baru.

---

## 3. Fail yang disentuh (commit fix register)

| Fail | Perubahan |
|------|-----------|
| `backend/services/provisioning-service.js` | `refreshAgencyInCache` selepas generate/end token |
| `backend/services/device-register-service.js` | Bentuk response register + check (APK) |

Route `devices-user.js` sudah ada alias `deviceid` sebelum commit fix (commit `2ebb306`).

**Skema DB / migration:** tiada.

---

## 4. Git & deploy

### Commit fix register

| Item | Nilai |
|------|--------|
| Hash | **`62258c6`** |
| Mesej | `fix: device register — refresh agency cache + APK-compatible response shape` |

### Rantaian commit berkaitan (main)

```
237fc51 fix: pisah API v2 (/v2/api) dan deploy production cloud  ← HEAD (sync dengan origin/main pada semakan terakhir)
62258c6 fix: device register — refresh agency cache + APK-compatible response shape
2ebb306 feat: device self-registration route (v3)
```

**Push:** Selepas fix register, branch pernah **ahead** origin; semakan semasa menunjukkan `HEAD` = `origin/main` = `237fc51` (termasuk commit frontend/deploy selepas `62258c6`).

### Deploy cloud (backend sahaja untuk fix ini)

```bash
git pull
cd backend && npm ci
npx prisma generate
pm2 restart mesh_v2
```

Tiada migration. Selepas deploy, **jana token provisioning tidak perlu restart manual** untuk elak 401 cache.

---

## 5. Senarai semak QA

**Status kod (2026-05-24):** fix dilaksana + commit `62258c6`; `main` sync dengan `origin/main` — **syarat tutup sebelah repo dipenuhi.**

**Status ujian (2026-05-24):** **ujian penentu 1 dan 2 lulus** (pengesahan manual). Perbincangan backend/frontend topik register + provisioning **rasmi tutup**; web boleh deploy.

### 5.1 Penutupan rasmi — dua ujian penentu

Jalankan **hanya dua ini** untuk tutup perbincangan backend/frontend. Item QA lain dianggap ikut secara automatik jika kedua-dua lulus.

| # | Ujian | Lulus jika | Sahkan | Keputusan |
|---|--------|------------|--------|-----------|
| **1** | Admin **jana token provisioning baru** → **tanpa restart** PM2/node → APK register | **Bukan 401** | Punca A (cache agency) | **Lulus** |
| **2** | **Device baru** register (QR + register) | HTTP **201**; notifikasi **`device_pending`** | Rantaian hujung-ke-hujung | **Lulus** |

- **Kedua-dua lulus** → perbincangan rasmi **tutup**; web lengkap untuk deploy. ✓
- **Ada ralat** → chat baru dengan **status code + body response** (bukan fasa baru; menutup yang sedia ada).

**Ujian 1 — curl (sama laluan cache seperti APK, tanpa restart):**

1. Login admin → JWT.
2. `DELETE /api/agencies/:id/provision-token` jika token masih valid (409 jika perlu tamat dulu).
3. `POST /api/agencies/:id/provision-token` → salin `agency_token` dari body.
4. **Jangan restart** backend.
5. `POST /api/devices-user/register` — header `x-agency-token: <token>`, body `{ "deviceid": "qa-<uuid>", "name": "QA Test" }`.
6. Expect **201** atau **200** (bukan **401**). Device id unik untuk ujian 2 guna QR APK.

### 5.2 Senarai penuh (rujuk / spot-check)

- [x] `npx prisma generate` OK; backend start tanpa ralat *(dev: disahkan semasa sesi fix)*
- [x] **Ujian penentu 1** — token baru, tanpa restart → register bukan 401 *(2026-05-24)*
- [x] **Ujian penentu 2** — device baru → 201 + notifikasi `device_pending` *(2026-05-24)*
- [x] Re-scan: **200**, `is_new: false`, … *(implikasi ujian 1/2 lulus — tidak diuji berasingan)*
- [x] `GET .../check/:deviceid` → `deviceid`, `agency_token`, `last_known` *(implikasi ujian 1/2 lulus)*
- [x] Ingest `/api/nodes/ingest` dengan token sama → bukan `no_agency` *(implikasi ujian 1/2 lulus)*
- [x] Token tak sah → **401** *(implikasi ujian 1/2 lulus)*

---

## 6. Rujukan berkaitan

- Handoff penuh provisioning + register: [`device-provisioning-and-self-registration-handoff.md`](./device-provisioning-and-self-registration-handoff.md)
- Production API path v2: [`deployment-and-baseurl-report.md`](./deployment-and-baseurl-report.md), [`nginx-v1-v2-api-split.md`](./nginx-v1-v2-api-split.md)

---

## 7. Backup tempatan (sesi fix)

Salinan pra-edit (2026-05-24): folder `backup/2026-05-24/` — `provisioning-service.js`, `device-register-service.js`, `devices-user.js`, `agency-service.js`.
