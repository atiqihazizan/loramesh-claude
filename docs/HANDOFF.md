# HANDOFF — debug MQTT → Socket.IO → frontend (loramesh v1)

Dikemas kini: 2026-10-29. Status: pembetulan sudah dideploy; pengesahan live penuh BELUM selesai.

## 1. Konteks
Masalah dilaporkan: data tracking dari MQTT nampak tak sampai / tak mengemas kini UI peta
walaupun log server senyap. Repo: https://github.com/atiqihazizan/loramesh-claude (branch `main`).

## 2. Persekitaran
- PC lokal (Windows): repo di `C:\myworks\loraMesh`. Fail bantuan lama di `C:\myworks\loraMesh_helpers`
  (check-server.bat/.sh, check-server-output.txt, diag-socket.mjs).
  PC baharu: `git clone https://github.com/atiqihazizan/loramesh-claude`, kemudian `cd frontend && npm ci`.
  Salinan `diag-socket.mjs` TIADA dalam git — kandungannya: sambung socket.io-client (websocket, path /socket.io)
  ke `http://localhost:5002` dengan JWT 5 minit (ditandatangan dari env.JWT_SECRET di server, pilih user agency 2),
  dengar `device:update`/`device:status` selama 35s, cetak bilangan. Tulis semula jika hilang.
- Server: `ssh mahsites.net` (atau `ssh atiqi@mahsites.net`; sama user `atiqi`, key-based, sudo tanpa password).
  - Servis: `mesh-v2.service` (root), `/var/www/loramesh/mesh_v2_git/backend/server.js`, PORT 5002.
  - Log: `sudo journalctl -u mesh-v2.service`.
  - Repo server `/var/www/loramesh/mesh_v2_git` dimiliki root → guna `sudo git ...`.
  - Frontend dilayan nginx dari `backend/public/` (output build, TIDAK ada dalam git; dimiliki `atiqi`).
  - Nginx: `/v2/socket.io/` → `127.0.0.1:5002/socket.io/` (Upgrade header OK). Domain: lora2u.com/v2, socketio.lora2u.com, websocket.lora2u.com.
  - Tiada test framework dalam package.json; ujian guna `node --test`.
- Frontend build: `VITE_APP_BASE=/v2/` (frontend/.env.production), output ke `../backend/public`.
- MQTT broker: `wss://mahsites.net:8887/ws` (kadang ECONNREFUSED 178.128.48.114:8887, auto-reconnect).
- Git lokal: identiti repo diset `atiqihazizan` / `aqi852000@gmail.com` (config lokal repo; set semula di PC baharu).

## 3. Aliran kod
`backend/realtime/mqtt-client.js` → `mqtt-handlers.js` → `tracking-pipeline.js processTracking`
(normalize → validate → route agency → enrich static cache → save throttle 3000ms → emit
`io.to("agency:<id>")` `device:update`/`device:status` throttle 2000ms).
`socket-server.js`: JWT auth; user biasa auto-join agency; superadmin guna `subscribe:agency`.
Frontend: `src/lib/socket.js`, `src/hooks/useDeviceSocket.js` (dipanggil di `src/map/MapContext.jsx`)
→ merge ke React Query key `["devices", agencyId]`. Semua komponen peta guna `useDevices` (key sepadan).
`useAgencyDevices` guna key `["devices","agency",id,search]` — hanya dipakai `pages/settings/DevicesPage.jsx`.

## 4. Telah disahkan (jangan ulang)
- Node 123456, 8865, 88880014 lulus normalize/validate/route ke agency 2; semua `is_static`, `logging_enabled=false`.
- Nginx + CORS betul; frontend connect socket & "switched to agency:2".
- `.env`: TRACKING_EMIT_VERBOSE=false (log senyap).
- **A:** `diag-socket.mjs` dijalankan di server (user admin_risda, agency 2): socket connected, terima
  `device:update` untuk 88880014 (online, 2.739059, 102.911197) dalam 35s → server→client BERFUNGSI.
  Hanya 88880014 terbit semasa tetingkap itu. Fail diag & socket.io-client sudah dibuang dari server.
- Tiada log "DB write error" dalam 24 jam. `git status` server asalnya hanya `D backend/scripts/migrate-from-legacy.js` (sedia ada).
- Selepas deploy: peta lora2u.com/v2 papar 6 elemen marker, bundle `index-BuM5EtVV.js` dimuatkan (sepadan build lokal).

## 5. Punca & perubahan (commit 2654f67)
1. **Frontend** — `mergeDevicePatch` hanya tapis `undefined`; `toSocketEmit` hantar `null` untuk lat/lon/sensor bila payload tiada
   → menimpa data REST → `hasValidCoords` gagal → marker hilang / data lama.
   Fix: `frontend/src/lib/mergeDevicePatch.js` (fungsi tulen, abai undefined & null), dipanggil dari `hooks/useDeviceSocket.js`.
   Kesan sampingan disengajakan: `null` sah (cth battery) tak menimpa nilai lama.
2. **Backend (node 8865)** — kod "NR" tiada dalam master `device_type` → `device_type_id` null → `live_tracking` upsert menimpa null
   & presence timeout guna lalai. Fix: `backend/lib/device-type-fallback.js` `resolveDeviceTypeId`, dipanggil dalam `tracking-pipeline.js` selepas enrich.
   Bergantung pada `devices.type_id` wujud (nilai sebenar 8865 BELUM disemak).
3. Ujian: `frontend/src/lib/mergeDevicePatch.test.js`, `backend/lib/device-type-fallback.test.js` — jalankan
   `node --test frontend/src/lib/mergeDevicePatch.test.js backend/lib/device-type-fallback.test.js` (7 lulus).
- Punca (1) ialah hasil analisis kod, BELUM terbukti sebagai punca gejala sebenar di UI.

## 6. Deploy yang dilakukan (2026-10-29 ~09:04 MYT)
1. Backup bundle lama di server: `~/rollback/public-before-2654f67.tgz` (isi: folder `public`).
2. Local: `cd frontend && npm ci && npm run build` → `backend/public`; tar → scp → ekstrak ke `/var/www/loramesh/mesh_v2_git/backend/`.
3. Server: `sudo git pull --ff-only` (c941bea → 2654f67); `sudo systemctl restart mesh-v2.service`; servis aktif, MQTT connect & subscribe semula.

### Rollback
- Backend: `cd /var/www/loramesh/mesh_v2_git && sudo git reset --hard c941bea && sudo systemctl restart mesh-v2.service`
  (peringatan: ini juga menghilangkan `D migrate-from-legacy.js` — semak `git status` dahulu).
- Frontend: `tar xzf ~/rollback/public-before-2654f67.tgz -C /var/www/loramesh/mesh_v2_git/backend/` (kemudian hard refresh).

## 7. BELUM selesai / langkah seterusnya
- Sahkan live di UI: log masuk lora2u.com/v2 (agency 2), klik marker node, perhati `status`/`send_dt`/`sensor_data`
  berubah bila node terbit MQTT. Percubaan auto semasa pane tersembunyi tak konklusif.
- Jika masih tak berubah walau node aktif: ulang diag di server (salin script ke `backend/scripts/`,
  `sudo npm i socket.io-client --no-save`, `sudo node scripts/diag-socket.mjs`, kemudian PADAM semuanya) dan/atau
  set sementara `TRACKING_EMIT_VERBOSE=true` (perlu pengesahan pengguna sebelum ubah .env/restart; pulihkan selepas).
- Semak `devices.type_id` untuk 8865 dan pertimbang tambah kod "NR" ke master `device_type`.
- Siasat broker MQTT ECONNREFUSED (07:06, 07:44) — berasingan.
- Pilihan: seragamkan key `useAgencyDevices` supaya Settings dapat live update (bukan punca masalah peta).

## 7b. Fitur: panel device — data live terakhir + sensor_data berlabel (2026-10-29)
- STATUS DEPLOY: commit 6c3a1a2 di-push ke GitHub; BACKEND dideploy ke server (11:58 MYT: `sudo git pull --ff-only` a68a6d9→6c3a1a2 +
  `sudo systemctl restart mesh-v2.service`; servis aktif, MQTT connect). Disahkan: `listDevices` di server pulang speed/cpu_temp/send_dt/
  sensor_data untuk 88880014 (`sensor_unit` masih null). FRONTEND (`backend/public`) BELUM dideploy; peta BELUM ditulis ke DB.
  Rollback backend: `cd /var/www/loramesh/mesh_v2_git && sudo git reset --hard v1.0.3 && sudo systemctl restart mesh-v2.service`.
- Backup sebelum kerja ini: tag `v1.0.3` (= a68a6d9) di GitHub; server `/var/www/loramesh/mesh_v2_git` ff-pull ke a68a6d9 (hanya docs; tiada restart).
  Beza tinggal di server: ` D backend/scripts/migrate-from-legacy.js` (sedia ada, tidak dipulihkan — auto mode sekat `git checkout --` di server).
- Masalah 1: panel papar "—" semasa load kerana `listDevices` (REST) tak hantar data live. Fix: `backend/services/device-service.js`
  `listDevices` kini baca `live_tracking` (speed, heading, cpu_temp, battery_level, sensor_data, send_dt) + hantar `sensor_unit`.
  (Punca hasil analisis kod; BELUM disahkan di UI.)
- Masalah 2: sensor_data mentah. Fix: `frontend/src/lib/sensorDecode.js` (+`.test.js`, 5 ujian) tukar array register → `[{key,label,unit,value,text}]`
  ikut peta per-device dalam `devices.sensor_unit` (JSON). `frontend/src/map/DeviceDetailPanel.jsx` papar satu baris label+nilai;
  tiada peta → paparan mentah lama. Entri peta: `{key,label,unit,idx,type:int16|float32,scale,wordSwap,dp,sensor_id?}`;
  float32+wordSwap: register pertama = low word (contoh pengguna 36536,17737 → 3224.92). `scale` 0.1 = "/10", 0.01 = "/100" (ikut sensor).
- Peta contoh node 88880014: `docs/sensor-map-88880014.json` (susunan = tafsiran dari PDF POC_Registers + data sebenar; suhu UV254 guna /100).
- Data server (baca sahaja): `devices.sensor_unit`/`sensor_data` semua NULL; `master_sensor` 27 baris, tiada COD/NH4+/DO/OIW/SS.
- Ujian: `node --test frontend/src/lib/*.test.js backend/lib/device-type-fallback.test.js` (12 lulus); `vite build` berjaya.
- BELUM: tulis peta ke `devices.sensor_unit` 88880014 di server (perlu kebenaran); deploy backend + frontend; sahkan unit COD/SS/NH4+/DO/OIW;
  `historical/SensorTab.jsx` masih mentah; entri `master_sensor` untuk `sensor_id`; UI edit peta.
- Deploy nanti: ikut bahagian 6 (backup `public` dahulu; backend `sudo git pull --ff-only` + restart `mesh-v2.service`; rollback ke tag v1.0.3).

## 8. Risiko terbuka
- Node static hanya emit bila ada mesej MQTT → UI "nampak statik" itu normal.
- Throttle emit 2s membuang mesej rapat; broker putus sekejap tanpa petunjuk UI.
- Patch socket diabaikan jika device tiada dalam senarai REST (reka bentuk sedia ada).

## 9. Fail sementara / pembersihan
- Server: tiada fail sementara tinggal (diag & tarball /tmp dipadam). `~/rollback/` sengaja dikekalkan.
- Lokal: `frontend/node_modules` & `backend/public` (build) — diabaikan git, boleh dipadam.
