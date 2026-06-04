// realtime/tracking-pipeline.js
// OTAK PUSAT untuk semua data tracking masuk.
// Dipanggil oleh MQTT handler (dan boleh juga Socket handler / REST).
//
// Aliran:
//   1. normalize  — payload mentah → bentuk kanonik
//   2. validate   — tolak kalau rosak
//   3. route      — cari agency mana device ni milik (guna agency_id)
//   4. enrich     — tambah info device dari cache
//   5. save       — live_tracking (throttled) + playback_* (sentiasa)
//   6. broadcast  — Socket.IO emit (throttled)

import { env } from '../config/env.js';
import {
  normalizeTrackingData,
  validateNormalized,
  toLiveTrackingRow,
  toPlaybackRow,
  toSocketEmit,
} from '../lib/data-structure.js';
import { getAgencyIdsByDeviceId } from '../lib/cache/device-agency-cache.js';
import { getAgencyById } from '../lib/cache/agency-cache.js';
import { getDeviceByDeviceId } from '../lib/cache/device-cache.js';
import { getDeviceStaticStatus } from '../lib/cache/device-static-cache.js';
import { insertPlaybackRow } from '../lib/playback.js';
import {
  persistLiveTrackingSnapshot,
  rawPayloadHasExplicitStatus,
} from '../lib/live-tracking-write.js';
import { DATA_SOURCE, STATUS_LIVE } from '../config/constants.js';
import { touchMqttPresence } from '../jobs/device-mqtt-presence.js';

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

  // --- 3. ROUTE: cari agency (guna agency_id) ---
  const agencyIds = getAgencyIdsByDeviceId(data.device_id);
  if (agencyIds.length === 0) {
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
  const explicitStatus = rawPayloadHasExplicitStatus(rawPayload);
  const doWrite =
    opts.forceWrite || explicitStatus || shouldWriteDb(data.device_id);

  // Untuk setiap agency device ni milik
  const agencyResults = [];
  /** @type {'status_only'|'full'|null} */
  let lastWriteMode = null;

  for (const agencyId of agencyIds) {
    const agency = getAgencyById(agencyId);
    if (!agency) continue;

    if (doWrite) {
      try {
        const liveRow = toLiveTrackingRow(data, agency.agencyId);
        const wr = await persistLiveTrackingSnapshot({ liveRow, data, staticStatus });
        lastWriteMode = wr.mode;
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

  if (source === DATA_SOURCE.MQTT) {
    touchMqttPresence(data.device_id, data.device_type_id, agencyIds, data.status_live);
  }

  // --- 6. BROADCAST Socket.IO ---
  const doBroadcast =
    opts.forceBroadcast || explicitStatus || shouldBroadcast(data.device_id);
  if (doBroadcast && ioRef) {
    const statusOnlyOffline =
      data.status_live === STATUS_LIVE.OFFLINE &&
      (lastWriteMode === 'status_only' ||
        (data.latitude == null && data.longitude == null));

    if (statusOnlyOffline) {
      for (const r of agencyResults) {
        ioRef.to(`agency:${r.agencyId}`).emit('device:status', {
          device_id: data.device_id,
          status_live: STATUS_LIVE.OFFLINE,
        });
      }
    } else {
      const emitData = toSocketEmit(data, deviceMeta);
      for (const r of agencyResults) {
        ioRef.to(`agency:${r.agencyId}`).emit('device:update', emitData);
      }
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