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
  sensor_data untuk 88880014 (`sensor_unit` masih null). FRONTEND dideploy (~12:00 MYT): backup `~/rollback/public-before-6c3a1a2.tgz`; build lokal `npm run build` →
  tar `public` → scp → `tar xzf` ke `backend/` (bundle `index-Hl9VtMt1.js`, disahkan dilayan oleh https://lora2u.com/v2/). Paparan UI BELUM disahkan manusia;
  peta BELUM ditulis ke DB (panel masih mentah sehingga itu).
  Rollback frontend: `tar xzf ~/rollback/public-before-6c3a1a2.tgz -C /var/www/loramesh/mesh_v2_git/backend/` + hard refresh.
  Rollback backend: `cd /var/www/loramesh/mesh_v2_git && sudo git reset --hard v1.0.3 && sudo systemctl restart mesh-v2.service`.
- Backup sebelum kerja ini: tag `v1.0.3` (= a68a6d9) di GitHub; server `/var/www/loramesh/mesh_v2_git` ff-pull ke a68a6d9 (hanya docs; tiada restart).
  Beza tinggal di server: ` D backend/scripts/migrate-from-legacy.js` (sedia ada, tidak dipulihkan — auto mode sekat `git checkout --` di server).
  KEMAS KINI: pengguna putuskan skrip itu tidak digunakan lagi → dibuang dari repo (git rm + buang skrip npm `migrate:from-legacy`);
  selepas server `git pull --ff-only`, beza ini hilang (server sudah memadamnya). Rollback fail: `git checkout <commit-sebelum> -- backend/scripts/migrate-from-legacy.js`.
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
- DB SERVER DIUBAH (2026-10-29, atas kebenaran pengguna): (1) backup `~/rollback/master_sensor-before-sensor-map.sql` (mysqldump master_sensor);
  (2) `master_sensor` +6 baris id 28–33: COD(mg/L 0–500), Water Temperature(°C 0–60), Suspended Solids Turbidity(NTU 0–4000),
  NH4+(mg/L 0–100), DO(mg/L 0–20), OIW(mg/L 0–200); id 11 Turbidity julat 0–1000, id 12 pH julat 0–14 (sebelum ini NULL).
  JULAT/UNIT = nilai LAZIM, BELUM disahkan dengan datasheet vendor (PDF tiada julat/unit). (3) `devices.sensor_unit` 88880014 = peta
  `docs/sensor-map-88880014.json` (9 entri, suhu /100 disahkan pengguna; sebelum itu NULL).
  UNDO: `DELETE FROM master_sensor WHERE id BETWEEN 28 AND 33; UPDATE master_sensor SET min_value=NULL,max_value=NULL WHERE id IN (11,12);
  UPDATE devices SET sensor_unit=NULL WHERE device_id='88880014';`
- Backend `listDevices` ganti `unit` setiap entri peta dengan `master_sensor.unit` ikut `sensor_id` (satu sumber unit/threshold; min/max
  dalam master untuk threshold masa depan — belum dipakai).
- DEPLOY (12:35 MYT): backend ke 0b3643a (`sudo git pull --ff-only` + restart `mesh-v2.service`, aktif, MQTT connect). Disahkan melalui
  `listDevices` di server: 9 entri peta 88880014 dengan unit dari master_sensor. Frontend tidak diubah (bundle index-Hl9VtMt1).
  Rollback backend: `sudo git reset --hard 6c3a1a2` (atau v1.0.3) + restart; kemudian UNDO DB di atas jika perlu.
- UI disahkan pengguna (2026-10-29): panel Boey 4 papar senarai berlabel dengan betul.
- DEPLOY (14:2x MYT): backend `402490e` (pull + restart, penulisan live_tracking/devices disahkan) dan frontend `e229e80` (backup
  `~/rollback/public-before-e229e80.tgz`; bundle `index-Bd0UGv8R.js` dilayan di lora2u.com/v2; server git = e229e80, status bersih; tiada restart
  untuk frontend). Rollback frontend: `tar xzf ~/rollback/public-before-e229e80.tgz -C /var/www/loramesh/mesh_v2_git/backend/` + hard refresh.
  Rollback kod: `sudo git reset --hard v1.0.4` + restart.
- PENGAWAL PANJANG (commit 565516d; frontend DIDEPLOY ~14:55 MYT: backup `~/rollback/public-before-565516d.tgz`, bundle `index-D-_B_fX7.js`
  dilayan, server git = 565516d bersih, tiada restart; rollback frontend: `tar xzf` backup itu ke `backend/` + hard refresh; paparan UI BELUM disahkan pengguna): `sensorDecode.js` `decodeSensors` kini pulang `null` jika panjang `sensor_data`
  (elemen kosong di hujung diabaikan) TIDAK sama dengan panjang peta (= max(idx + 2 utk float32 / 1 utk int16)) → panel jatuh balik ke
  paparan mentah, Historical papar "—" (bukan nilai palsu bagi susunan sensor lama/berbeza). AKIBAT: SEMUA register mesti dipetakan
  (peta separa akan sentiasa ditolak) — UI Settings nanti perlu benarkan entri "tidak digunakan". 8 ujian sensorDecode lulus (19 keseluruhan).
  Rancangan seterusnya (BELUM): peta berversi bertarikh berkuat kuasa supaya sejarah dinyahkod dengan peta zamannya (bersama UI Settings).
- HISTORICAL KOSONG — PUNCA & TINDAKAN (2026-10-29 14:26 MYT): semua device statik `logging_enabled=0` → pipeline tak tulis playback →
  `playback_88880014` tidak wujud (log_mqtt ada 10,056 mesej 88880014 sejak 25 Okt). Atas kebenaran pengguna: `UPDATE devices SET
  logging_enabled=1 WHERE device_id='88880014'` (nilai lama 0 di server `~/rollback/logging-enabled-before.txt`) + restart `mesh-v2.service`
  (cache device-static dimuat ketika startup sahaja — UPDATE terus DB tanpa restart/PATCH API tidak berkesan). Disahkan: `playback_88880014` dicipta,
  baris pertama 06:27:02 UTC (14:27 MYT), metadata didaftar. UNDO: `UPDATE ... logging_enabled=0` + restart.
  ISI SEMULA SEJARAH (14:30 MYT, atas kebenaran pengguna): skrip sementara di server (kini DIPADAM; salinan tiada dalam git) guna kod aplikasi
  (`normalizeTrackingData` + `toPlaybackRow`, koordinat statik dari `devices`) menulis 8,698 baris dari `log_mqtt` (88880014) ke
  `playback_88880014`; sempadan = `send_dt` < baris playback terawal (elak pendua). Hasil: 8,704 baris, 2026-10-25 16:43Z → semasa; taburan hari
  sepadan `log_mqtt`. HANYA susunan `sensor_data` 14 elemen (padan peta semasa) diisi; 1,360 baris susunan lama (6 elemen: 281, 4 elemen: 1,079;
  25–26 Okt, tetapan sensor berbeza) DILANGKAU kerana akan dinyahkod salah — masih ada dalam `log_mqtt`. `received_at` baris isi semula = masa
  isi semula (bukan masa terima sebenar; `log_mqtt.received_at` UTC vs playback guna jam DB — beza 8 jam, jangan banding terus).
  Backup (root, mod 600): `~/rollback/playback_88880014-before-backfill.sql` (hanya baris sebelum isi semula).
  UNDO: `DELETE FROM playback_88880014 WHERE send_dt < '2026-10-29 06:27:02';` (baris asal selepas itu dikekalkan).
  BELUM: Boey 1–3 & Water Quality masih
  logging 0 (tidak diubah, sebab asal tidak diketahui); PAPARAN HISTORICAL DISAHKAN PENGGUNA (tangkapan skrin, 1,049 baris untuk 29 Okt, kolum berlabel+unit betul, nilai
  sepadan nyahkod); zon masa OK — julat 00:00–23:59 ditafsir MYT dan masa dipapar MYT (baris 14:27:02 = mesej pertama selepas logging hidup).
- Historical berlabel (frontend DIDEPLOY, paparan BELUM disahkan pengguna): `HistoricalSidebar.jsx` bawa `sensor_unit` device terpilih dalam `query.sensorUnit` →
  `HistoricalPage.jsx` → `SensorTab.jsx` paparkan SATU KOLUM per parameter (header label + unit, nilai dinyahkod `decodeSensors`); tiada
  peta → kolum "Sensor data" mentah seperti dahulu. Hanya `vite build` + 16 ujian lulus; TIADA ujian komponen & belum dilihat di UI.
- BELUM: sahkan unit/julat dengan datasheet vendor; sahkan Historical di UI selepas deploy frontend; UI edit peta;
  threshold/amaran; peta untuk device lain.
- FIX (lokal, BELUM deploy): `backend/lib/live-tracking-write.js` upsert `update` tidak lagi menimpa `live_tracking.sensor_data` dengan null bila
  payload tiada sensor_data (sebelum ini mesej status boleh memadam nilai terakhir → refresh papar "—"). DIKEMAS KINI (lokal, BELUM deploy): `backend/lib/present-fields.js`
  (`pickPresent`, `KEEP_LAST_KEYS = speed, cpu_temp, sensor_data`) kini dipakai untuk upsert `live_tracking` DAN `devices.updateMany`
  (speed/cpu_temp) — mesej tanpa medan itu kekal nilai lama (keputusan pengguna: ia bukan dari sensor_data). Ujian `present-fields.test.js` (4);
  `live-tracking-write.js` sendiri hanya disahkan sintaks. Medan lain (heading, battery_level, motion_status, lat/lon) masih ditimpa null.
  Skrip npm tanpa fail (`migrate:playback-tables`, `verify-data`, `seed:pilot`) dibuang dari `backend/package.json` (tiada rujukan lain).
- CADANGAN reka bentuk (BELUM dibuat, catatan perbincangan):
  - Peta register per-device (`devices.sensor_unit`) sudah mengasingkan sensor antara device (water quality / hujan / cuaca); `master_sensor`
    = katalog (nama, unit, julat) sahaja. Data GPS (lat/lon/speed/heading) bukan sensor, kekal medan sendiri.
  - Tambah lajur `master_sensor.category` (VARCHAR, nullable; cth water_quality/weather/level) HANYA bila UI pemilih sensor dibina — migrasi
    Prisma + SQL server, selamat (nullable).
  - Elak satu baris master untuk dua konteks (cth Temperature id 1 = suhu persekitaran vs Water Temperature id 29); asingkan baris.
  - Pilihan kemudian: templat peta lalai per jenis device (lajur JSON pada `device_type`) disalin ke device baharu.
  - HAD `sensorDecode.js`: register int16 dibaca TANPA TANDA (0–65535); sensor nilai negatif (suhu <0 °C) perlu pilihan `signed` + ujian
    sebelum dipakai.
- Deploy nanti: ikut bahagian 6 (backup `public` dahulu; backend `sudo git pull --ff-only` + restart `mesh-v2.service`; rollback ke tag v1.0.3).

### 7c. Editor peta sensor (fasa 1) — DIDEPLOY 2026-10-29 ~17:06 MYT (commit 450724b), BELUM dilihat/diuji pengguna di UI
- DEPLOY: push 565516d→450724b; backup `~/rollback/public-before-450724b.tgz`; server `sudo git pull --ff-only` (bersih); build lokal → tar → scp → ekstrak
  ke `backend/`; `sudo systemctl restart mesh-v2.service` (aktif, MQTT subscribe semula); `DevicesPage-DSoVzrt_.js` (mengandungi editor) dilayan di lora2u.com/v2.
  Rollback frontend: `tar xzf ~/rollback/public-before-450724b.tgz -C /var/www/loramesh/mesh_v2_git/backend/` + hard refresh;
  backend: `sudo git reset --hard 565516d && sudo systemctl restart mesh-v2.service`. Simpan peta dari UI BELUM diuji terhadap DB sebenar.
- UI: `frontend/src/components/settings/SensorMapModal.jsx`, dibuka dari ikon "Sensor map" pada baris device di `pages/settings/DevicesPage.jsx`
  (ADMIN_AGENCY+ sama seperti Edit). Baris = urutan register; `idx` dikira automatik (int16 = 1, float32 = 2). Pilih master sensor (`GET /sensors`,
  semua pengguna log masuk), label, jenis/formula (raw, ÷10, ÷100, ÷1000, float32 swap/biasa, Unused), dp. Pratonton guna `sensor_data` terakhir;
  bar padanan panjang peta vs data (hijau/kuning). Peta kosong → hantar `null` (kembali ke paparan mentah).
- Backend: `backend/lib/sensor-map.js` (`validateSensorMap`) dipanggil dalam `updateDevice` (`device-service.js`) bagi `patch.sensor_unit`;
  `null` → `Prisma.DbNull`. Peraturan: sensor_id wujud dalam master_sensor, type int16/float32/skip, scale 1/0.1/0.01/0.001, dp 0–6, key unik,
  TIADA celah/pertindihan register (guna "skip"). `unit` tidak disimpan jika ada sensor_id (datang dari master semasa `listDevices`).
- `sensorDecode.js`: entri `type:'skip'` dikira dalam panjang tetapi tidak dipaparkan; eksport `requiredLength`/`effectiveLength`; pilihan `ignoreLength`.
- Ujian: `backend/lib/sensor-map.test.js` (5), `sensorDecode.test.js` (9) — lulus; `vite build` lulus; peta sebenar 88880014 lulus pengesah.
  BELUM ada ujian komponen dan BELUM diuji klik di browser; tiada ujian `updateDevice` terhadap DB.
- Had: tiada versi peta berkesan-tarikh (menyimpan peta baharu mengubah tafsiran data sejarah); tiada `category`; tiada `signed` int16.
  Kunci (`key`) dijana semula daripada label setiap simpan.
- SEMAKAN `POC_Registers1.pdf` (pembetulan vendor, 2026-10-29): susunan 13 register, formula (/10, /10, /100 suhu UV254; IEEE754 big-endian + word swap
  untuk pH, SS turbidity, SS suhu, NH4+; /100 DO & OIW) SEMUA sepadan dengan peta semasa. Beza tinggal: unit OIW dalam PDF = ppm, `master_sensor` id 33 = mg/L
  (BELUM diubah). Unit turbidity NTU/FNU/FTU masih bertanda "??" oleh vendor sendiri.
- Sahkan: `cd backend && node --test lib/*.test.js`; `cd frontend && node --test src/lib/*.test.js && npx vite build`.

## 8. Risiko terbuka
- Node static hanya emit bila ada mesej MQTT → UI "nampak statik" itu normal.
- Throttle emit 2s membuang mesej rapat; broker putus sekejap tanpa petunjuk UI.
- Patch socket diabaikan jika device tiada dalam senarai REST (reka bentuk sedia ada).

## 9. Fail sementara / pembersihan
- Server: tiada fail sementara tinggal (diag & tarball /tmp dipadam). `~/rollback/` sengaja dikekalkan.
- Lokal: `frontend/node_modules` & `backend/public` (build) — diabaikan git, boleh dipadam.
