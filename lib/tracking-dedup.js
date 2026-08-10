// lib/tracking-dedup.js
// Tapisan data redundan untuk playback — multi-field + merge state global per device.
// Backfill = sumber playback. Bundle = live_tracking/broadcast (playback skip bila redundan).

import { SENSOR_SPECIAL } from '../config/constants.js';
import { env } from '../config/env.js';

// =====================================================================
// HELPERS
// =====================================================================

function roundNum(v, decimals) {
  if (v == null || !Number.isFinite(v)) return null;
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

function isSentinelValue(val) {
  if (typeof val === 'number' && SENSOR_SPECIAL.NO_DATA.includes(val)) return true;
  if (typeof val === 'string') {
    return SENSOR_SPECIAL.ERROR.includes(val) || SENSOR_SPECIAL.TIMEOUT.includes(val);
  }
  return false;
}

function normalizeSensor(sensor) {
  if (sensor == null) return null;

  function walk(val) {
    if (val == null) return undefined;
    if (Array.isArray(val)) {
      const items = val.map(walk).filter((x) => x !== undefined);
      return items.length ? items : undefined;
    }
    if (typeof val === 'object') {
      const out = {};
      for (const k of Object.keys(val).sort()) {
        const v = walk(val[k]);
        if (v !== undefined) out[k] = v;
      }
      return Object.keys(out).length ? out : undefined;
    }
    if (typeof val === 'number') {
      if (isSentinelValue(val)) return undefined;
      return roundNum(val, 3);
    }
    if (typeof val === 'string') {
      if (isSentinelValue(val)) return val;
      const n = parseFloat(val);
      return Number.isFinite(n) ? roundNum(n, 3) : val;
    }
    return val;
  }

  const normalized = walk(sensor);
  if (normalized == null) return null;
  return JSON.stringify(normalized);
}

export function getSendDtMs(data) {
  if (data.send_dt instanceof Date) return data.send_dt.getTime();
  if (data.send_dt) {
    const t = new Date(data.send_dt).getTime();
    return Number.isFinite(t) ? t : Date.now();
  }
  return data.received_at?.getTime?.() ?? Date.now();
}

// =====================================================================
// FINGERPRINT
// =====================================================================

export function buildFingerprint(data) {
  const lat = roundNum(data.latitude, 6);
  const lon = roundNum(data.longitude, 6);
  return {
    pos: lat != null && lon != null ? `${lat},${lon}` : null,
    speed: roundNum(data.speed, 2),
    heading: roundNum(data.heading, 1),
    accuracy: roundNum(data.accuracy, 1),
    battery: data.battery_level ?? null,
    cpu: roundNum(data.cpu_temp, 1),
    status: data.status_live ?? null,
    motion: data.motion_status ?? null,
    sensor: normalizeSensor(data.sensor_data),
  };
}

export function isSignificantChange(prev, next) {
  if (!prev) return true;
  if (prev.status !== next.status) return true;
  if (prev.motion !== next.motion) return true;
  if (prev.pos !== next.pos) return true;
  if (prev.speed !== next.speed) return true;
  if (prev.heading !== next.heading) return true;
  if (prev.accuracy !== next.accuracy) return true;
  if (prev.battery !== next.battery) return true;
  if (prev.cpu !== next.cpu) return true;
  if (prev.sensor !== next.sensor) return true;
  return false;
}

// =====================================================================
// PER-DEVICE STATE (in-memory)
// =====================================================================

/** @type {Map<string, { fingerprint: object|null, maxSendDtMs: number, backfillUntilMs: number }>} */
const deviceState = new Map();

function emptyState() {
  return { fingerprint: null, maxSendDtMs: 0, backfillUntilMs: 0 };
}

function graceMs() {
  return env.TRACKING_BACKFILL_GRACE_MS;
}

export function getDeviceFingerprint(deviceId) {
  return deviceState.get(deviceId)?.fingerprint ?? null;
}

/**
 * Patut skip INSERT playback?
 * Bundle: skip bila redundan global ATAU backfill baru cover data sama tik.
 * Backfill/gateway: skip bila redundan global sahaja.
 */
export function shouldSkipPlayback(deviceId, data, opts = {}) {
  const fp = buildFingerprint(data);
  const state = deviceState.get(deviceId);
  const now = Date.now();

  if (state?.fingerprint && !isSignificantChange(state.fingerprint, fp)) {
    return { skip: true, reason: 'redundant_state', fingerprint: fp };
  }

  if (opts.sourceKind === 'bundle' && state?.backfillUntilMs && now <= state.backfillUntilMs) {
    return { skip: true, reason: 'bundle_covered_by_backfill', fingerprint: fp };
  }

  return { skip: false, fingerprint: fp };
}

export function recordPlaybackSaved(deviceId, fingerprint, sendDtMs) {
  const prev = deviceState.get(deviceId) || emptyState();
  deviceState.set(deviceId, {
    fingerprint,
    maxSendDtMs: Math.max(prev.maxSendDtMs, sendDtMs),
    backfillUntilMs: prev.backfillUntilMs,
  });
}

export function markBackfillProcessing(deviceId) {
  const prev = deviceState.get(deviceId) || emptyState();
  deviceState.set(deviceId, {
    ...prev,
    backfillUntilMs: Date.now() + graceMs(),
  });
}

export function finalizeBackfill(deviceId, maxSendDtMs, fingerprint) {
  const prev = deviceState.get(deviceId) || emptyState();
  deviceState.set(deviceId, {
    fingerprint: fingerprint ?? prev.fingerprint,
    maxSendDtMs: Math.max(prev.maxSendDtMs, maxSendDtMs),
    backfillUntilMs: Date.now() + graceMs(),
  });
}

/**
 * Tapiskan batch backfill — merge dengan fingerprint global (merentas saat/batch).
 */
export function dedupNormalizedBatch(items, deviceId) {
  const sorted = [...items].sort((a, b) => getSendDtMs(a) - getSendDtMs(b));
  const kept = [];
  let prevFp = getDeviceFingerprint(deviceId);

  for (const data of sorted) {
    const fp = buildFingerprint(data);
    if (isSignificantChange(prevFp, fp)) {
      kept.push({ data, fingerprint: fp, sendMs: getSendDtMs(data) });
      prevFp = fp;
    }
  }

  return kept;
}

export function cleanupDedupState(maxAgeMs = 10 * 60 * 1000) {
  const now = Date.now();
  for (const [id, st] of deviceState.entries()) {
    const lastActivity = Math.max(st.backfillUntilMs || 0, st.maxSendDtMs || 0);
    if (now - lastActivity > maxAgeMs) deviceState.delete(id);
  }
}
