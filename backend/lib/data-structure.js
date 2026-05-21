// lib/data-structure.js
// Standardize incoming tracking data from MQTT (Flutter) and Socket.IO (web).
// Different sources send slightly different shapes — this file enforces ONE
// canonical structure that the rest of the pipeline can rely on.

import {
  STATUS_LIVE,
  STATUS_LIVE_VALID,
  STATUS_LIVE_DEFAULT,
  DATA_SOURCE,
  DATA_TYPE,
  MOTION_STATUS,
  SENSOR_SPECIAL,
  DATA_STRUCTURE_VERSION,
} from '../config/constants.js';

// =====================================================================
// CANONICAL SHAPE
// =====================================================================
// Every tracking payload after normalization looks like this:
// {
//   device_id:    string,
//   data_type:    'MG' | 'LR',
//   data_source:  'mqtt' | 'socketio',
//
//   latitude:     number | null,
//   longitude:    number | null,
//   speed:        number | null,
//   heading:      number | null,
//   accuracy:     number | null,
//
//   status_live:   'online' | 'offline' | 'idle',
//   motion_status: 'moving' | 'idle' | null,
//
//   cpu_temp:      number | null,
//   battery_level: number | null,
//   transmission_type: string | null,
//   device_model:  string | null,
//   device_os:     string | null,
//
//   sensor_data:   object | null,
//
//   send_dt:       Date | null,   // device clock
//   node_dt:       Date | null,   // gateway clock (LoRa only)
//   received_at:   Date,           // server clock
//
//   _meta: {
//     version: '3.0.0',
//     raw: <original>,
//     errors: [],
//   }
// }
// =====================================================================

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function toNumberOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function toIntOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? Math.trunc(v) : parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function toDateOrNull(v) {
  if (!v) return null;
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v : null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

function clampLat(v) {
  const n = toNumberOrNull(v);
  return n !== null && n >= -90 && n <= 90 ? n : null;
}
function clampLng(v) {
  const n = toNumberOrNull(v);
  return n !== null && n >= -180 && n <= 180 ? n : null;
}
function clampHeading(v) {
  const n = toNumberOrNull(v);
  if (n === null) return null;
  // Normalize to 0-360
  let h = n % 360;
  if (h < 0) h += 360;
  return h;
}

function pickFirst(obj, keys) {
  for (const k of keys) {
    if (obj?.[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return null;
}

/**
 * Detect data_type by inspecting raw payload.
 * MG (modbus_go / Flutter) usually has 'transmission_type' or 'device_os'.
 * LR (LoRa Node-Red) usually has 'node_id', 'node_dt'.
 */
function inferDataType(raw) {
  if (raw.data_type === 'MG' || raw.data_type === 'LR') return raw.data_type;
  if (raw.transmission_type || raw.device_os) return DATA_TYPE.MODBUS_GO;
  if (raw.node_id || raw.node_dt) return DATA_TYPE.LORA;
  return DATA_TYPE.MODBUS_GO; // default
}

/**
 * Normalize status_live. Accept variations: 'online', 'ONLINE', 'Online', etc.
 */
function normalizeStatusLive(v) {
  if (!v) return null;
  const lower = String(v).toLowerCase().trim();
  if (STATUS_LIVE_VALID.includes(lower)) return lower;
  // Map common aliases
  if (lower === 'on' || lower === 'active') return STATUS_LIVE.ONLINE;
  if (lower === 'off' || lower === 'disconnected') return STATUS_LIVE.OFFLINE;
  return null;
}

/**
 * Normalize sensor_data into consistent JSON shape.
 * Accept string (JSON), object, or null. Returns object or null.
 */
function normalizeSensorData(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && !Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      return typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Main normalization function.
 *
 * @param {object} raw - incoming payload from MQTT or Socket.IO
 * @param {'mqtt'|'socketio'} source
 * @returns {object|null} normalized data, or null if invalid
 */
export function normalizeTrackingData(raw, source = DATA_SOURCE.MQTT) {
  if (!raw || typeof raw !== 'object') return null;

  const errors = [];

  // --- device_id (REQUIRED) ---
  const device_id = pickFirst(raw, ['device_id', 'node_id', 'deviceId', 'nodeId']);
  if (!device_id) {
    return null; // hard fail — can't route without device_id
  }

  // --- type & source ---
  const data_type = inferDataType(raw);
  const data_source = source === DATA_SOURCE.SOCKETIO ? DATA_SOURCE.SOCKETIO : DATA_SOURCE.MQTT;

  // --- coordinates ---
  const latitude = clampLat(pickFirst(raw, ['latitude', 'lat']));
  const longitude = clampLng(pickFirst(raw, ['longitude', 'lng', 'lon']));

  // --- motion fields ---
  const speed = toNumberOrNull(pickFirst(raw, ['speed', 'velocity']));
  const heading = clampHeading(pickFirst(raw, ['heading', 'bearing', 'course']));
  const accuracy = toNumberOrNull(pickFirst(raw, ['accuracy', 'hdop']));

  // --- status ---
  let status_live = normalizeStatusLive(pickFirst(raw, ['status_live', 'status']));
  if (!status_live) {
    status_live = STATUS_LIVE_DEFAULT;
    errors.push('status_live missing or invalid, defaulted to offline');
  }

  let motion_status = null;
  const rawMotion = pickFirst(raw, ['motion_status', 'motion']);
  if (rawMotion) {
    const m = String(rawMotion).toLowerCase().trim();
    if (m === MOTION_STATUS.MOVING || m === MOTION_STATUS.IDLE) motion_status = m;
  }
  // Auto-infer if speed available
  if (!motion_status && speed !== null) {
    motion_status = speed > 0.5 ? MOTION_STATUS.MOVING : MOTION_STATUS.IDLE;
  }

  // --- device telemetry ---
  const cpu_temp = toNumberOrNull(pickFirst(raw, ['cpu_temp', 'node_cpu_temp', 'temperature']));
  const battery_level = toIntOrNull(pickFirst(raw, ['battery_level', 'battery', 'batt']));
  const transmission_type = pickFirst(raw, ['transmission_type', 'tx_type']);
  const device_model = pickFirst(raw, ['device_model', 'model']);
  const device_os = pickFirst(raw, ['device_os', 'os']);

  // --- sensors ---
  const sensor_data = normalizeSensorData(raw.sensor_data ?? raw.sensors);

  // --- timestamps ---
  const send_dt = toDateOrNull(pickFirst(raw, ['send_dt', 'timestamp', 'ts']));
  const node_dt = toDateOrNull(pickFirst(raw, ['node_dt']));
  const received_at = new Date();

  return {
    device_id: String(device_id),
    data_type,
    data_source,

    latitude,
    longitude,
    speed,
    heading,
    accuracy,

    status_live,
    motion_status,

    cpu_temp,
    battery_level,
    transmission_type,
    device_model,
    device_os,

    sensor_data,

    send_dt,
    node_dt,
    received_at,

    _meta: {
      version: DATA_STRUCTURE_VERSION,
      errors,
    },
  };
}

/**
 * Validate normalized data. Returns {valid, reason}.
 * Use after normalize() before persisting.
 */
export function validateNormalized(data) {
  if (!data || typeof data !== 'object') return { valid: false, reason: 'not_object' };
  if (!data.device_id) return { valid: false, reason: 'no_device_id' };
  if (!STATUS_LIVE_VALID.includes(data.status_live))
    return { valid: false, reason: 'invalid_status_live' };

  // For online status, lat/lng should ideally be present (warn but allow)
  // For offline, lat/lng can be null
  return { valid: true };
}

/**
 * Detect "no data" sensor values. Used by some sensor types where reading
 * is intentionally tagged as missing (e.g. [-1], 'ERR', 'TMO').
 */
export function isSensorNoData(value) {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) {
    if (value.length === 0) return true;
    if (value.length === 1) {
      if (SENSOR_SPECIAL.NO_DATA.includes(value[0])) return true;
      if (SENSOR_SPECIAL.ERROR.includes(value[0])) return true;
      if (SENSOR_SPECIAL.TIMEOUT.includes(value[0])) return true;
    }
  }
  return false;
}

/**
 * Extract subset of normalized data for `live_tracking` table update.
 */
export function toLiveTrackingRow(normalized, agencyId, deviceTypeId = null) {
  return {
    device_id: normalized.device_id,
    agency_id: agencyId,
    device_type_id: deviceTypeId,
    latitude: normalized.latitude,
    longitude: normalized.longitude,
    speed: normalized.speed,
    heading: normalized.heading,
    accuracy: normalized.accuracy,
    status_live: normalized.status_live,
    motion_status: normalized.motion_status,
    cpu_temp: normalized.cpu_temp,
    battery_level: normalized.battery_level,
    transmission_type: normalized.transmission_type,
    device_model: normalized.device_model,
    device_os: normalized.device_os,
    sensor_data: normalized.sensor_data,
    send_dt: normalized.send_dt,
    node_dt: normalized.node_dt,
  };
}

/**
 * Extract subset for `playback_{device_id}` row.
 */
export function toPlaybackRow(normalized) {
  return {
    device_id: normalized.device_id,
    latitude: normalized.latitude,
    longitude: normalized.longitude,
    speed: normalized.speed,
    heading: normalized.heading,
    accuracy: normalized.accuracy,
    cpu_temp: normalized.cpu_temp,
    battery_level: normalized.battery_level,
    sensor_data: normalized.sensor_data ? JSON.stringify(normalized.sensor_data) : null,
    status_live: normalized.status_live,
    send_dt: normalized.send_dt,
  };
}

/**
 * Shape for outbound Socket.IO emit to frontend.
 * Compact — strip _meta, strip nulls.
 */
export function toSocketEmit(normalized, deviceMeta = {}) {
  const out = {
    device_id: normalized.device_id,
    data_type: normalized.data_type,
    name: deviceMeta.name || null,
    device_type_id: deviceMeta.type_id || null,
    is_static: deviceMeta.is_static || false,

    latitude: normalized.latitude,
    longitude: normalized.longitude,
    speed: normalized.speed,
    heading: normalized.heading,

    status_live: normalized.status_live,
    motion_status: normalized.motion_status,
    cpu_temp: normalized.cpu_temp,
    battery_level: normalized.battery_level,

    sensor_data: normalized.sensor_data,

    send_dt: normalized.send_dt?.toISOString() || null,
    received_at: normalized.received_at.toISOString(),
  };
  return out;
}