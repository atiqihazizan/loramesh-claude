// realtime/tracking-pipeline.js
// OTAK PUSAT untuk semua data tracking masuk.
// Dipanggil oleh MQTT handler (dan boleh juga Socket handler / REST).
//
// Aliran:
//   1. normalize  — payload mentah → bentuk kanonik
//   2. validate   — tolak kalau rosak
//   3. route      — cari agency mana device ni milik
//   4. enrich     — tambah info device dari cache
//   5. save       — live_tracking (throttled) + playback_* (sentiasa)
//   6. broadcast  — Socket.IO emit (throttled)

import prisma from '../lib/prisma.js';
import { env } from '../config/env.js';
import {
  normalizeTrackingData,
  validateNormalized,
  toLiveTrackingRow,
  toPlaybackRow,
  toSocketEmit,
} from '../lib/data-structure.js';
import { getAgencyTokensByDeviceId } from '../lib/cache/device-agency-cache.js';
import { getAgencyFromCache } from '../lib/cache/agency-cache.js';
import { getDeviceByDeviceId, updateDeviceInCache } from '../lib/cache/device-cache.js';
import { getDeviceStaticStatus } from '../lib/cache/device-static-cache.js';
import { insertPlaybackRow } from '../lib/playback.js';

// =====================================================================
// THROTTLE STATE (in-memory; reset on restart)
// =====================================================================

/** Map<device_id, lastDbWriteMs> */
const lastDbWrite = new Map();
/** Map<device_id, lastBroadcastMs> */
const lastBroadcast = new Map();

function shouldWriteDb(deviceId) {
  const now = Date.now();
  const last = lastDbWrite.get(deviceId) || 0;
  if (now - last >= env.TRACKING_DB_THROTTLE_MS) {
    lastDbWrite.set(deviceId, now);
    return true;
  }
  return false;
}

function shouldBroadcast(deviceId) {
  const now = Date.now();
  const last = lastBroadcast.get(deviceId) || 0;
  if (now - last >= env.TRACKING_BROADCAST_THROTTLE_MS) {
    lastBroadcast.set(deviceId, now);
    return true;
  }
  return false;
}

/** Cleanup throttle maps — buang entry device yang dah lama senyap. */
export function cleanupThrottleMaps(maxAgeMs = 10 * 60 * 1000) {
  const now = Date.now();
  for (const [id, ts] of lastDbWrite.entries()) {
    if (now - ts > maxAgeMs) lastDbWrite.delete(id);
  }
  for (const [id, ts] of lastBroadcast.entries()) {
    if (now - ts > maxAgeMs) lastBroadcast.delete(id);
  }
}

// =====================================================================
// SOCKET.IO REFERENCE (di-set oleh socket-server.js masa startup)
// =====================================================================

let ioRef = null;
export function setSocketIO(io) {
  ioRef = io;
}

// =====================================================================
// MAIN PIPELINE
// =====================================================================

/**
 * Proses satu payload tracking.
 *
 * @param {object} rawPayload  - data mentah dari MQTT/Socket
 * @param {'mqtt'|'socketio'} source
 * @param {object} [opts]
 * @param {boolean} [opts.forceWrite]      - abai throttle DB (cth backfill)
 * @param {boolean} [opts.forceBroadcast]  - abai throttle broadcast
 * @returns {Promise<{ok, reason?, device_id?, agencies?}>}
 */
export async function processTracking(rawPayload, source, opts = {}) {
  // --- 1. NORMALIZE ---
  const data = normalizeTrackingData(rawPayload, source);
  if (!data) {
    return { ok: false, reason: 'normalize_failed' };
  }

  // --- 2. VALIDATE ---
  const validation = validateNormalized(data);
  if (!validation.valid) {
    return { ok: false, reason: validation.reason, device_id: data.device_id };
  }

  // --- 3. ROUTE: cari agency ---
  const agencyTokens = getAgencyTokensByDeviceId(data.device_id);
  if (agencyTokens.length === 0) {
    // Device belum di-assign ke mana-mana agency — abai (bukan error)
    if (env.MQTT.VERBOSE_LOG) {
      console.log(`[pipeline] Device ${data.device_id} belum assigned ke agency — skip`);
    }
    return { ok: false, reason: 'no_agency', device_id: data.device_id };
  }

  // --- 4. ENRICH: info device dari cache ---
  const deviceMeta = getDeviceByDeviceId(data.device_id) || {};
  const staticStatus = getDeviceStaticStatus(data.device_id);

  // Kalau device static, guna posisi tetap dari cache (sensor static tak gerak)
  if (staticStatus?.is_static) {
    if (staticStatus.latitude != null) data.latitude = staticStatus.latitude;
    if (staticStatus.longitude != null) data.longitude = staticStatus.longitude;
  }

  // Logging on/off — kalau device set logging_enabled=false, skip playback write
  const loggingEnabled = staticStatus ? staticStatus.logging_enabled !== false : true;

  // --- 5. SAVE ---
  const doWrite = opts.forceWrite || shouldWriteDb(data.device_id);

  // Untuk setiap agency device ni milik
  const agencyResults = [];
  for (const token of agencyTokens) {
    const agency = getAgencyFromCache(token);
    if (!agency) continue;

    if (doWrite) {
      try {
        // 5a. Upsert live_tracking (snapshot semasa)
        const liveRow = toLiveTrackingRow(data, agency.agencyId);
        await prisma.live_tracking.upsert({
          where: { device_id: data.device_id },
          create: liveRow,
          update: {
            agency_id: liveRow.agency_id,
            device_type_id: liveRow.device_type_id,
            latitude: liveRow.latitude,
            longitude: liveRow.longitude,
            speed: liveRow.speed,
            heading: liveRow.heading,
            accuracy: liveRow.accuracy,
            status_live: liveRow.status_live,
            motion_status: liveRow.motion_status,
            cpu_temp: liveRow.cpu_temp,
            battery_level: liveRow.battery_level,
            transmission_type: liveRow.transmission_type,
            device_model: liveRow.device_model,
            device_os: liveRow.device_os,
            sensor_data: liveRow.sensor_data,
            send_dt: liveRow.send_dt,
            node_dt: liveRow.node_dt,
            received_at: liveRow.received_at,
          },
        });

        // 5b. Update devices.last_seen_at + denormalized fields
        await prisma.devices.updateMany({
          where: { device_id: data.device_id },
          data: {
            last_seen_at: data.received_at,
            status: data.status_live,
            send_dt: data.send_dt,
            node_dt: data.node_dt,
            cpu_temp: data.cpu_temp,
            speed: data.speed,
            heading: data.heading,
            ...(staticStatus?.is_static
              ? {}
              : { latitude: data.latitude, longitude: data.longitude }),
          },
        });

        // Sync cache
        updateDeviceInCache(data.device_id, {
          status: data.status_live,
        });
      } catch (e) {
        console.error(`[pipeline] DB write error (${data.device_id}):`, e.message);
      }
    }

    agencyResults.push({ agencyId: agency.agencyId, agencyCode: agency.agencyCode });
  }

  // 5c. Playback — SENTIASA tulis (untuk historical penuh), kecuali logging off
  if (loggingEnabled && (opts.forceWrite || data.latitude != null || data.sensor_data != null)) {
    try {
      await insertPlaybackRow(data.device_id, toPlaybackRow(data));
    } catch (e) {
      console.error(`[pipeline] Playback write error (${data.device_id}):`, e.message);
    }
  }

  // --- 6. BROADCAST Socket.IO ---
  const doBroadcast = opts.forceBroadcast || shouldBroadcast(data.device_id);
  if (doBroadcast && ioRef) {
    const emitData = toSocketEmit(data, deviceMeta);
    for (const r of agencyResults) {
      ioRef.to(`agency:${r.agencyId}`).emit('device:update', emitData);
    }
  }

  return {
    ok: true,
    device_id: data.device_id,
    agencies: agencyResults.map((r) => r.agencyCode),
    written: doWrite,
    broadcasted: doBroadcast,
    errors: data._meta.errors,
  };
}

/**
 * Proses banyak payload sekali gus (cth backfill dari Flutter).
 * Semua di-force-write (historical mesti lengkap), broadcast hanya yang terakhir.
 */
export async function processTrackingBatch(payloads, source) {
  const results = [];
  for (let i = 0; i < payloads.length; i++) {
    const isLast = i === payloads.length - 1;
    const r = await processTracking(payloads[i], source, {
      forceWrite: true,
      forceBroadcast: isLast,
    });
    results.push(r);
  }
  return {
    total: payloads.length,
    ok: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}
