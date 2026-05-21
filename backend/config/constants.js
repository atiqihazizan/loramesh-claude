// config/constants.js
// Shared enums / constants. Single source of truth.
// All frozen — never mutate.

// ============================================
// ROLES
// ============================================
export const ROLES = Object.freeze({
  SUPERADMIN: 'SUPERADMIN',
  ADMIN_AGENCY: 'ADMIN_AGENCY',
  USER_AGENCY: 'USER_AGENCY',
  VIEWER: 'VIEWER',
});

export const ROLE_RANK = Object.freeze({
  SUPERADMIN: 100,
  ADMIN_AGENCY: 50,
  USER_AGENCY: 10,
  VIEWER: 1,
});

export const isRoleAtLeast = (userRole, minRole) =>
  (ROLE_RANK[userRole] || 0) >= (ROLE_RANK[minRole] || 0);

// ============================================
// DEVICE STATUS
// ============================================
export const STATUS_LIVE = Object.freeze({
  ONLINE: 'online',
  OFFLINE: 'offline',
  IDLE: 'idle',
});

export const STATUS_LIVE_VALID = Object.freeze([
  STATUS_LIVE.ONLINE,
  STATUS_LIVE.OFFLINE,
  STATUS_LIVE.IDLE,
]);

export const STATUS_LIVE_DEFAULT = STATUS_LIVE.OFFLINE;

export const isStatusLiveValid = (s) => STATUS_LIVE_VALID.includes(s);

// ============================================
// DATA SOURCE (channel asal data — bukan device_type)
// ============================================
export const DATA_SOURCE = Object.freeze({
  MQTT: 'mqtt',         // dari Flutter / LoRa Node-Red via MQTT broker
  SOCKETIO: 'socketio', // dari frontend via Socket.IO (jarang — biasanya frontend receive sahaja)
});

// ============================================
// NOTA: data_type
// ============================================
// `data_type` dalam payload MQTT BUKAN enum tetap.
// Ia adalah pointer ke `device_type.code` dalam DB.
// Contoh nilai: ND, TD, LM, TB, WS, RF, GW, MG.
// Resolve guna lib/cache/device-type-cache.js → getDeviceTypeByCode().
// Jangan hard-code senarai data_type di sini — ia dinamik ikut DB.

// ============================================
// MOTION
// ============================================
export const MOTION_STATUS = Object.freeze({
  MOVING: 'moving',
  IDLE: 'idle',
});

export const MOTION_SPEED_THRESHOLD = 0.5; // m/s atau km/h — atas ni dikira "moving"

export const SENSOR_SPECIAL = Object.freeze({
  NO_DATA: [-1],
  ERROR: ['ERR'],
  TIMEOUT: ['TMO'],
});

// ============================================
// MQTT TOPICS
// ============================================
export const MQTT_TOPICS = Object.freeze({
  // Flutter modbus_go (inbound) — wildcard subscribe
  MOBILE_BUNDLE:   'LoRa/tracking/+/bundle',
  MOBILE_STATUS:   'LoRa/tracking/+/status',
  MOBILE_BACKFILL: 'LoRa/tracking/+/backfill',

  // Outbound ACK ke Flutter
  mobileAck: (deviceId) => `LoRa/tracking/${deviceId}/ack`,

  // LoRa Node-Red / Gateway (inbound)
  GATEWAY_DATA: 'LoRa/Node/Data/+',

  // System health
  SYSTEM_PING: 'LoRa/system/ping',
  SYSTEM_PONG: 'LoRa/system/pong',
});

// ============================================
// SOCKET.IO EVENTS
// ============================================
export const SOCKET_EVENTS = Object.freeze({
  // server → client
  DEVICE_UPDATE: 'device:update',     // satu device update
  DEVICE_BATCH:  'device:batch',      // banyak device sekali (initial load)
  DEVICE_STATUS: 'device:status',     // status_live change sahaja
  DEVICE_REMOVED: 'device:removed',

  // client → server
  SUBSCRIBE_AGENCY: 'subscribe:agency',
});

// ============================================
// AGENCY DEFAULTS
// ============================================
export const AGENCY_DEFAULTS = Object.freeze({
  MAP_CENTER: '3.1390,101.6869',
  MAP_ZOOM: 13,
  TILE_PROVIDER: 'osm',
  TRACKING_ZOOM_MOVING: 17,
  TRACKING_ZOOM_STOPPED: 15,
  TRACKING_STOP_RADIUS_M: 10,
});

// ============================================
// VERSIONING
// ============================================
export const DATA_STRUCTURE_VERSION = '3.0.0';
