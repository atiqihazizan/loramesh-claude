// lib/data-structure.js
// Standardize incoming tracking data from MQTT (Flutter/Gateway) and Socket.IO.
// Enforces ONE canonical structure regardless of source.

import {
  STATUS_LIVE,
  STATUS_LIVE_VALID,
  STATUS_LIVE_DEFAULT,
  DATA_SOURCE,
  MOTION_STATUS,
  MOTION_SPEED_THRESHOLD,
  SENSOR_SPECIAL,
  DATA_STRUCTURE_VERSION,
} from '../config/constants.js';
import { parseTrackingDate } from '../utils/date.js';
import { getDeviceTypeByCode } from './cache/device-type-cache.js';

// =====================================================================
// HELPERS
// =====================================================================

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

function normalizeStatusLive(v) {
  if (!v) return null;
  const lower = String(v).toLowerCase().trim();
  if (STATUS_LIVE_VALID.includes(lower)) return lower;
  if (lower === 'on' || lower === 'active') return STATUS_LIVE.ONLINE;
  if (lower === 'off' || lower === 'disconnected') return STATUS_LIVE.OFFLINE;
  return null;
}

function normalizeSensorData(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') return v; // array atau object — biarkan
  if (typeof v === 'string') {
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  }
  return null;
}

// =====================================================================
// MAIN NORMALIZE
// =====================================================================

/**
 * Normalize incoming payload to canonical shape.
 *
 * @param {object} raw - payload dari MQTT / Socket.IO
 * @param {'mqtt'|'socketio'} source
 * @returns {object|null} normalized, atau null kalau invalid
 */
export function normalizeTrackingData(raw, source = DATA_SOURCE.MQTT) {
  if (!raw || typeof raw !== 'object') return null;

  const errors = [];

  // --- device_id (WAJIB) ---
  const device_id = pickFirst(raw, ['device_id', 'deviceId', 'node_id', 'nodeId']);
  if (!device_id) return null; // tak boleh route tanpa device_id

  // --- data_type — pointer ke device_type.code (TIDAK di-teka) ---
  const data_type = pickFirst(raw, ['data_type', 'dataType']) || null;
  let deviceType = null;
  if (data_type) {
    deviceType = getDeviceTypeByCode(data_type); // null kalau tak wujud dalam DB
    if (!deviceType) {
      errors.push(`data_type "${data_type}" tiada dalam device_type master`);
    }
  } else {
    errors.push('data_type missing');
  }

  const data_source = source === DATA_SOURCE.SOCKETIO ? DATA_SOURCE.SOCKETIO : DATA_SOURCE.MQTT;

  // --- coordinates ---
  const latitude = clampLat(pickFirst(raw, ['latitude', 'lat']));
  const longitude = clampLng(pickFirst(raw, ['longitude', 'lng', 'lon']));

  // --- motion ---
  const speed = toNumberOrNull(pickFirst(raw, ['speed', 'velocity']));
  const heading = clampHeading(pickFirst(raw, ['heading', 'bearing', 'course']));
  const accuracy = toNumberOrNull(pickFirst(raw, ['accuracy', 'hdop']));

  // --- status ---
  let status_live = normalizeStatusLive(pickFirst(raw, ['status_live', 'status']));
  if (!status_live) {
    status_live = STATUS_LIVE_DEFAULT;
    errors.push('status_live missing/invalid → defaulted offline');
  }

  let motion_status = null;
  const rawMotion = pickFirst(raw, ['motion_status', 'motion']);
  if (rawMotion) {
    const m = String(rawMotion).toLowerCase().trim();
    if (m === MOTION_STATUS.MOVING || m === MOTION_STATUS.IDLE) motion_status = m;
  }
  if (!motion_status && speed !== null) {
    motion_status = speed > MOTION_SPEED_THRESHOLD ? MOTION_STATUS.MOVING : MOTION_STATUS.IDLE;
  }

  // --- telemetry ---
  const cpu_temp = toNumberOrNull(pickFirst(raw, ['cpu_temp', 'node_cpu_temp', 'temperature']));
  const battery_level = toIntOrNull(pickFirst(raw, ['battery_level', 'battery', 'batt']));
  const transmission_type = pickFirst(raw, ['transmission_type', 'tx_type']);
  const device_model = pickFirst(raw, ['device_model', 'model']);
  const device_os = pickFirst(raw, ['device_os', 'os']);
  const device_mac = pickFirst(raw, ['mac_address', 'device_mac', 'mac']);
  const device_name = pickFirst(raw, ['name']);
  const session_token = pickFirst(raw, ['session_token']); // disimpan dalam metadata sahaja

  // --- sensors ---
  const sensor_data = normalizeSensorData(raw.sensor_data ?? raw.sensors);

  // --- timestamps (guna parser yang handle 2 format) ---
  const send_dt = parseTrackingDate(pickFirst(raw, ['send_dt', 'timestamp', 'ts']));
  const node_dt = parseTrackingDate(pickFirst(raw, ['node_dt']));
  const received_at = new Date();

  return {
    device_id: String(device_id),
    data_type,                              // string code, cth "MG", "GW"
    device_type_id: deviceType?.id || null, // resolved id, atau null
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
    device_mac,
    device_name,

    sensor_data,

    send_dt,
    node_dt,
    received_at,

    _meta: {
      version: DATA_STRUCTURE_VERSION,
      session_token: session_token || null,
      errors,
    },
  };
}

/**
 * Validasi normalized data sebelum simpan.
 */
export function validateNormalized(data) {
  if (!data || typeof data !== 'object') return { valid: false, reason: 'not_object' };
  if (!data.device_id) return { valid: false, reason: 'no_device_id' };
  if (!STATUS_LIVE_VALID.includes(data.status_live))
    return { valid: false, reason: 'invalid_status_live' };
  return { valid: true };
}

export function isSensorNoData(value) {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) {
    if (value.length === 0) return true;
    if (value.length === 1) {
      const v = value[0];
      if (SENSOR_SPECIAL.NO_DATA.includes(Number(v))) return true;
      if (SENSOR_SPECIAL.ERROR.includes(v)) return true;
      if (SENSOR_SPECIAL.TIMEOUT.includes(v)) return true;
    }
  }
  return false;
}

// =====================================================================
// SHAPE CONVERTERS
// =====================================================================

export function toLiveTrackingRow(n, agencyId) {
  return {
    device_id: n.device_id,
    agency_id: agencyId,
    device_type_id: n.device_type_id,
    latitude: n.latitude,
    longitude: n.longitude,
    speed: n.speed,
    heading: n.heading,
    accuracy: n.accuracy,
    status_live: n.status_live,
    motion_status: n.motion_status,
    cpu_temp: n.cpu_temp,
    battery_level: n.battery_level,
    transmission_type: n.transmission_type,
    device_model: n.device_model,
    device_os: n.device_os,
    sensor_data: n.sensor_data,
    send_dt: n.send_dt,
    node_dt: n.node_dt,
  };
}

export function toPlaybackRow(n) {
  return {
    device_id: n.device_id,
    latitude: n.latitude,
    longitude: n.longitude,
    speed: n.speed,
    heading: n.heading,
    accuracy: n.accuracy,
    cpu_temp: n.cpu_temp,
    battery_level: n.battery_level,
    sensor_data: n.sensor_data ? JSON.stringify(n.sensor_data) : null,
    status_live: n.status_live,
    send_dt: n.send_dt,
  };
}

/**
 * Shape untuk Socket.IO emit ke frontend. Compact.
 */
export function toSocketEmit(n, deviceMeta = {}) {
  return {
    device_id: n.device_id,
    data_type: n.data_type,
    device_type_id: n.device_type_id,
    name: deviceMeta.name || n.device_name || null,
    is_static: deviceMeta.is_static || false,

    latitude: n.latitude,
    longitude: n.longitude,
    speed: n.speed,
    heading: n.heading,

    status_live: n.status_live,
    motion_status: n.motion_status,
    cpu_temp: n.cpu_temp,
    battery_level: n.battery_level,

    sensor_data: n.sensor_data,

    send_dt: n.send_dt ? n.send_dt.toISOString() : null,
    received_at: n.received_at.toISOString(),
  };
}
