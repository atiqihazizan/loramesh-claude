// config/constants.js
// Shared enums / constants. Single source of truth.
// All frozen — never mutate.

// ============================================
// ROLES
// ============================================
export const ROLES = Object.freeze({
  SUPERADMIN: 'SUPERADMIN',         // admin projek — manage agencies, system
  ADMIN_AGENCY: 'ADMIN_AGENCY',     // admin user — manage users/devices dalam agency
  USER_AGENCY: 'USER_AGENCY',       // user biasa — view map, historical
  VIEWER: 'VIEWER',                  // read-only
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
// DATA SOURCE & TYPE
// ============================================
export const DATA_SOURCE = Object.freeze({
  MQTT: 'mqtt',
  SOCKETIO: 'socketio',
});

export const DATA_TYPE = Object.freeze({
  MODBUS_GO: 'MG',   // Flutter modbus_go (mobile)
  LORA: 'LR',         // LoRa Node-Red
});

export const MOTION_STATUS = Object.freeze({
  MOVING: 'moving',
  IDLE: 'idle',
});

export const SENSOR_SPECIAL = Object.freeze({
  NO_DATA: [-1],
  ERROR: ['ERR'],
  TIMEOUT: ['TMO'],
});

// ============================================
// MQTT TOPICS
// ============================================
export const MQTT_TOPICS = Object.freeze({
  // Flutter modbus_go (inbound)
  MODBUSGO_BUNDLE: 'LoRa/tracking/+/bundle',
  MODBUSGO_STATUS: 'LoRa/tracking/+/status',
  MODBUSGO_BACKFILL: 'LoRa/tracking/+/backfill',

  // Outbound to Flutter (function returns topic for given device)
  modbusgoAck: (deviceId) => `LoRa/tracking/${deviceId}/ack`,

  // LoRa Node-Red
  LORA_NODE_DATA: 'LoRa/Node/Data/+',

  // System health
  SYSTEM_PING: 'LoRa/system/ping',
  SYSTEM_PONG: 'LoRa/system/pong',
});

// ============================================
// AGENCY DEFAULTS (untuk create new agency)
// ============================================
export const AGENCY_DEFAULTS = Object.freeze({
  MAP_CENTER: '3.1390,101.6869',       // Kuala Lumpur
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