# PANDUAN RUJUKAN SISTEM v3 (LoRa Mesh Tracking)

> Sumber tunggal sahih selepas kod lama (`lora2u_nodejs`, `lora2u_react`, `modbus_go`) dibuang dari project knowledge.
> Disusun: 2026-06-02. Semua maklumat disahkan dari kod v3 sebenar.

---

## A. STRUKTUR PROJEK v3

- **Backend:** folder `backend/` (Node.js + Prisma + MySQL **unified DB** — satu DB, bukan per-agency lagi)
- **Frontend:** folder `frontend/` (React + Vite + TailwindCSS + React Query + Zustand authStore)
- **APK target:** `https://lora2u.com/v2/api` (base path `/v2/api`)

---

## B. PETA FAIL PENTING v3

### Backend (`backend/`)
| Fail | Tugas |
|---|---|
| `config/env.js` | Single source env. **MQTT cloud SEBENAR (disahkan dari .env cloud 2026-06-02): `wss://mahsites.net:8887/ws`, user=`wsmqtt`, pass=`w5mqtt`.** |
| `config/constants.js` | `MQTT_TOPICS`, `SOCKET_EVENTS`, `DATA_SOURCE` |
| `realtime/mqtt-client.js` | Connect broker, subscribe topic, route ke handler |
| `realtime/mqtt-handlers.js` | Parse topic → `processTracking()`. Topic kind: bundle/status/backfill/gateway |
| `realtime/tracking-pipeline.js` | **OTAK PUSAT** semua data tracking: normalize→validate→route→enrich→save→broadcast |
| `realtime/socket-server.js` | Socket.IO server, auth **JWT**, room = `agency:${id}` |
| `realtime/socket-handlers.js` | Handler event socket |
| `services/tracking-service.js` | Wrapper REST→pipeline (`ingestSingle`, `ingestBatch`, `getLiveSnapshot`) |
| `lib/data-structure.js` | `normalizeTrackingData`, `validateNormalized`, `toLiveTrackingRow`, `toPlaybackRow`, `toSocketEmit` |
| `lib/cache/agency-cache.js` | **Map<agency_token, {agencyId,...}>** ← MASIH TOKEN |
| `lib/cache/device-agency-cache.js` | **Map<device_id, Set<agency_token>>** ← MASIH TOKEN |
| `lib/cache/device-cache.js` | Info device |
| `lib/cache/device-static-cache.js` | Status static/logging device |
| `lib/playback.js` | Tulis `playback_{device_id}` (raw SQL dinamik) |

### Frontend (`frontend/`)
| Fail | Tugas |
|---|---|
| `hooks/useDeviceSocket.js` | Realtime: join room guna `agency_id`, listen `device:update`/`device:status`, merge ke React Query |
| `lib/socket.js` | `connectSocket()` shared socket |
| `store/authStore.js` | Auth, `isSuperadmin()` |

---

## C. FLOW DATA REALTIME (v3 sebenar)

```
APK/Sensor → MQTT broker → mqtt-client.js (subscribe)
   → mqtt-handlers.js (parse topic, tentukan kind)
   → tracking-pipeline.js processTracking():
       1. normalizeTrackingData(payload)
       2. validateNormalized()
       3. ROUTE: getAgencyTokensByDeviceId(device_id) ← guna device_id, dapat token
       4. enrich dari device-cache + static-cache
       5. SAVE: live_tracking.upsert (throttled) + playback_{id} (sentiasa)
       6. BROADCAST: io.to(room).emit (throttled)
```

**Penting:** Pipeline ROUTE guna `device_id` → dapat agency. Payload TAK perlu token. (Inilah sebab payload sensor LoRa tiada token — backend lookup sendiri.)

### Topik MQTT (dari `mqtt-handlers.js` + `constants.js`)
- `LoRa/tracking/{device_id}/bundle` → kind `bundle` (data tracking mobile) + ACK balik
- `LoRa/tracking/{device_id}/status` → kind `status` (heartbeat)
- `LoRa/tracking/{device_id}/backfill` → kind `backfill` (offline queue, array)
- `LoRa/Node/Data/{node_id}` → kind `gateway` (sensor LoRa)
- ACK keluar: `MQTT_TOPICS.mobileAck(deviceId)` = `LoRa/tracking/{device_id}/ack`

### Socket.IO (v3 — `socket-server.js`)
- Auth: **JWT** (handshake.auth.token) — bukan agency_token
- Room: **`agency:${user.agency.id}`** ← SUDAH agency_id
- Frontend (`useDeviceSocket.js`): superadmin emit `subscribe:agency {agency_id}`; user biasa auto-join server-side
- Event: `device:update`, `device:status` (guna titik bukan dash: `device:update` bukan `device-update`)

---

## D. SCHEMA DB v3 (Prisma — unified, MySQL)

- `agency`: id (PK), name, code, **agency_token** (unique, untuk QR/daftar sahaja), status, agency_token_expires_at, default_map_*, tracking_zoom_*
- `devices`: id, **device_id** (unique, dulu `deviceid`), device_mac, name, type_id, status, latitude/longitude (static), is_static, logging_enabled, **need_approval**, date_approved, last_seen_at
- `device_agency`: id, **device_id (Int FK)**, **agency_id (Int FK)**, active, name. Unique(device_id, agency_id). ← JOIN guna agency_id
- `live_tracking`: device_id (unique), **agency_id (Int)**, device_type_id, lat/lon/speed/heading, status_live, sensor_data ← SUDAH agency_id
- `device_log`: device_id, old_agency_id, new_agency_id, change_type
- `user_agency`: user_id, agency_id

**KESIMPULAN SCHEMA:** DB sudah penuh guna `agency_id`. `agency_token` cuma untuk QR/daftar. Hanya **cache layer** yang masih berkunci token.

---

## E. TITIK MIGRASI SEBENAR (token → agency_id)

Schema & socket room & frontend SUDAH agency_id. Yang tinggal hanya **2 cache + cara pipeline guna**:

| # | Fail | Sekarang | Tukar |
|---|---|---|---|
| 1 | `lib/cache/agency-cache.js` | `Map<agency_token, {...}>` | `Map<agency_id, {...}>` + `getAgencyById(id)` |
| 2 | `lib/cache/device-agency-cache.js` | `Map<device_id, Set<agency_token>>` | `Map<device_id, Set<agency_id>>` + `getAgencyIdsByDeviceId()` |
| 3 | `realtime/tracking-pipeline.js` | loop `agencyTokens` → `getAgencyFromCache(token)` | loop `agencyIds` → `getAgencyById(id)` |

**Yang TAK perlu sentuh (dah betul):** `socket-server.js` (room dah `agency:${id}`), `frontend/useDeviceSocket.js` (dah agency_id), schema DB, `mqtt-handlers.js` (guna device_id), `live_tracking` (dah agency_id).

> NOTA: ini JAUH lebih kecil dari jadual asal 5-tempat. v3 dah separuh jalan. Risiko rendah.

---

## F. FLUTTER (modbus_go) — keperluan Fasa 4

Publish payload dengan `node_id` (= device_id), TANPA token:
```json
{ "node_id": "<device_id>", "send_dt": "...", "node_dt": "...",
  "data_type": "...", "node_cpu_temp": "...", "latitude": "...",
  "longitude": "...", "speed": "...", "sensor_data": [...] }
```
- Topik publish: `LoRa/tracking/{device_id}/bundle` (masuk kind `bundle`)
- Broker SEBENAR (disahkan .env cloud, SAMA untuk backend & Flutter): **`wss://mahsites.net:8887/ws`**, user=`wsmqtt`, pass=`w5mqtt`
- NOTA: broker `178.128.48.114:8887/mqtt` + `w5mqtt24.` ialah broker LAMA (lora2u_nodejs, dah dibuang) — JANGAN guna.
- Backend v3 `MQTT_ENABLED=true`, subscribe broker yang sama. Disahkan connect: `[mqtt] ✓ Connected to broker`.

---

## G. PRINSIP KEKAL
1. Approval = keselamatan sebenar (admin reject device tak sah).
2. `agency_token` = kunci QR/daftar SAHAJA (tiada expiry/rotate, tiada dalam payload).
3. `device_id` & `agency_id` = primary key, paksi semua routing.
4. Matlamat: stabil seperti sebelum ubah. Uji setiap peringkat.