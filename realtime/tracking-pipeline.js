// realtime/tracking-pipeline.js
// OTAK PUSAT untuk semua data tracking masuk.
// Dipanggil oleh MQTT handler (dan boleh juga Socket handler / REST).
//
// Aliran:
//   1. normalize  — payload mentah → bentuk kanonik
//   2. validate   — tolak kalau rosak
//   3. route      — cari agency mana device ni milik (guna agency_id)
//   4. enrich     — tambah info device dari cache
//   5. save       — live_tracking (throttled) + playback_* (dedup)
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
import {
  shouldSkipPlayback,
  recordPlaybackSaved,
  markBackfillProcessing,
  finalizeBackfill,
  dedupNormalizedBatch,
  getSendDtMs,
  getDeviceFingerprint,
  cleanupDedupState,
} from '../lib/tracking-dedup.js';
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

/** Cleanup throttle + dedup maps — buang entry device yang dah lama senyap. */
export function cleanupThrottleMaps(maxAgeMs = 10 * 60 * 1000) {
  const now = Date.now();
  for (const [id, ts] of lastDbWrite.entries()) {
    if (now - ts > maxAgeMs) lastDbWrite.delete(id);
  }
  for (const [id, ts] of lastBroadcast.entries()) {
    if (now - ts > maxAgeMs) lastBroadcast.delete(id);
  }
  cleanupDedupState(maxAgeMs);
}

// =====================================================================
// SOCKET.IO REFERENCE (di-set oleh socket-server.js masa startup)
// =====================================================================

let ioRef = null;
export function setSocketIO(io) {
  ioRef = io;
}

// =====================================================================
// PLAYBACK WRITE (dengan dedup)
// =====================================================================

async function maybeWritePlayback(data, opts = {}) {
  const hasPlaybackSignal = data.latitude != null || data.sensor_data != null;
  if (!hasPlaybackSignal) {
    return { saved: false, reason: 'no_playback_signal' };
  }

  const dedup = shouldSkipPlayback(data.device_id, data, {
    sourceKind: opts.sourceKind,
  });
  if (dedup.skip) {
    return { saved: false, reason: dedup.reason };
  }

  await insertPlaybackRow(data.device_id, toPlaybackRow(data));
  recordPlaybackSaved(data.device_id, dedup.fingerprint, getSendDtMs(data));
  return { saved: true };
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
 * @param {boolean} [opts.forceWrite]           - abai throttle DB (cth backfill)
 * @param {boolean} [opts.forceBroadcast]       - abai throttle broadcast
 * @param {string} [opts.sourceKind]            - bundle | backfill | gateway | status
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
    if (env.MQTT.VERBOSE_LOG) {
      console.log(`[pipeline] Device ${data.device_id} belum assigned ke agency — skip`);
    }
    return { ok: false, reason: 'no_agency', device_id: data.device_id };
  }

  // --- 4. ENRICH: info device dari cache ---
  const deviceMeta = getDeviceByDeviceId(data.device_id) || {};
  const staticStatus = getDeviceStaticStatus(data.device_id);

  if (staticStatus?.is_static) {
    if (staticStatus.latitude != null) data.latitude = staticStatus.latitude;
    if (staticStatus.longitude != null) data.longitude = staticStatus.longitude;
  }

  const loggingEnabled = staticStatus ? staticStatus.logging_enabled !== false : true;

  // --- 5. SAVE ---
  const explicitStatus = rawPayloadHasExplicitStatus(rawPayload);
  const doWrite =
    opts.forceWrite || explicitStatus || shouldWriteDb(data.device_id);

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

  let playbackSaved = false;
  let playbackSkipReason = null;

  if (loggingEnabled) {
    try {
      const pr = await maybeWritePlayback(data, {
        sourceKind: opts.sourceKind,
      });
      playbackSaved = pr.saved;
      playbackSkipReason = pr.reason || null;
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
    playbackSaved,
    playbackSkipReason,
    errors: data._meta.errors,
  };
}

/**
 * Proses banyak payload sekali gus (cth backfill dari Flutter).
 * Dedup batch dahulu, kemudian force-write setiap item unik.
 */
export async function processTrackingBatch(payloads, source) {
  if (!Array.isArray(payloads) || payloads.length === 0) {
    return { total: 0, ok: 0, failed: 0, deduped: 0, skipped: 0, results: [] };
  }

  const parsed = [];
  for (const raw of payloads) {
    const data = normalizeTrackingData(raw, source);
    if (!data) continue;
    const validation = validateNormalized(data);
    if (!validation.valid) continue;
    parsed.push({ raw, data });
  }

  if (parsed.length === 0) {
    return {
      total: payloads.length,
      ok: 0,
      failed: payloads.length,
      deduped: 0,
      skipped: payloads.length,
      results: [],
    };
  }

  const deviceId = parsed[0].data.device_id;
  markBackfillProcessing(deviceId);

  const deduped = dedupNormalizedBatch(
    parsed.map((p) => p.data),
    deviceId
  );
  const skipped = parsed.length - deduped.length;

  const results = [];
  let maxSendMs = 0;
  let lastFingerprint = getDeviceFingerprint(deviceId);

  if (deduped.length === 0) {
    finalizeBackfill(deviceId, 0, lastFingerprint);
    if (env.MQTT.VERBOSE_LOG && skipped > 0) {
      console.log(
        `[pipeline] Backfill dedup ${deviceId}: 0/${parsed.length} disimpan, ${skipped} redundan (global)`
      );
    }
    return {
      total: payloads.length,
      ok: 0,
      failed: 0,
      deduped: 0,
      skipped,
      playbackSaved: 0,
      playbackSkipped: 0,
      results: [],
    };
  }

  for (let i = 0; i < deduped.length; i++) {
    const { data, sendMs } = deduped[i];
    const raw = parsed.find((p) => p.data === data)?.raw ?? data;
    const isLast = i === deduped.length - 1;

    const r = await processTracking(raw, source, {
      forceWrite: true,
      forceBroadcast: isLast,
      sourceKind: 'backfill',
    });
    results.push(r);
    maxSendMs = Math.max(maxSendMs, sendMs);
    lastFingerprint = deduped[i].fingerprint;
  }

  finalizeBackfill(deviceId, maxSendMs, lastFingerprint);

  if (env.MQTT.VERBOSE_LOG && skipped > 0) {
    console.log(
      `[pipeline] Backfill dedup ${deviceId}: ${deduped.length}/${parsed.length} disimpan, ${skipped} redundan`
    );
  }

  return {
    total: payloads.length,
    ok: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    deduped: deduped.length,
    skipped,
    playbackSaved: results.filter((r) => r.playbackSaved).length,
    playbackSkipped: results.filter((r) => !r.playbackSaved && r.ok).length,
    results,
  };
}
