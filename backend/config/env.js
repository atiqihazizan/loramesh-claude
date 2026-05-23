// config/env.js
// Single source of truth for env vars. Fail-fast on startup if required missing.
// Import this BEFORE any other module so process.env is loaded.

import dotenv from 'dotenv';
dotenv.config();

const REQUIRED = ['DATABASE_URL', 'JWT_SECRET'];

function need(key, fallback = undefined) {
  const v = process.env[key];
  if (v === undefined || v === '') {
    return fallback === undefined ? null : fallback;
  }
  return v;
}

function int(key, fallback) {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function bool(key, fallback) {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  return v.toLowerCase() === 'true' || v === '1';
}

// --- Fail-fast validation ---
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error('[env] ❌ Missing required env vars:', missing.join(', '));
  console.error('[env]    Copy .env.example to .env and fill in values.');
  process.exit(1);
}

// Set process timezone before anything else
process.env.TZ = need('TIMEZONE', 'Asia/Kuala_Lumpur');

export const env = {
  NODE_ENV: need('NODE_ENV', 'development'),
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  PORT: int('PORT', 5002),
  TIMEZONE: process.env.TZ,

  // Database
  DATABASE_URL: need('DATABASE_URL'),

  // Auth
  JWT_SECRET: need('JWT_SECRET'),
  JWT_EXPIRES_IN: need('JWT_EXPIRES_IN', '7d'),
  BCRYPT_ROUNDS: int('BCRYPT_ROUNDS', 10),

  // CORS
  CORS_ORIGINS: (need('CORS_ORIGIN', 'http://localhost:5173') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // Socket.IO
  USE_RAW_TRACKING: bool('USE_RAW_TRACKING', false),
  TRACKING_EMIT_VERBOSE: bool('TRACKING_EMIT_VERBOSE', false),

  // MQTT
  MQTT: {
    ENABLED: bool('MQTT_ENABLED', false),
    HOST: need('MQTT_HOST', 'mahsites.net'),
    PORT: int('MQTT_PORT', 8887),
    PROTOCOL: need('MQTT_PROTOCOL', 'wss'),
    BASEPATH: need('MQTT_BASEPATH', 'ws'),
    USERNAME: need('MQTT_USERNAME', ''),
    PASSWORD: need('MQTT_PASSWORD', ''),

    PROCESS_CONCURRENCY: int('MQTT_PROCESS_CONCURRENCY', 8),
    SUBSCRIBE_QOS: int('MQTT_SUBSCRIBE_QOS', 2),
    MOBILE_SUBSCRIBE_QOS: int('MQTT_MOBILE_SUBSCRIBE_QOS', 1),
    LOG_INCOMING_DB: bool('MQTT_LOG_INCOMING_DB', true),
    VERBOSE_LOG: bool('MQTT_VERBOSE_LOG', false),
  },

  // Tracking throttle
  TRACKING_DB_THROTTLE_MS: int('TRACKING_DB_THROTTLE_MS', 3000),
  TRACKING_BROADCAST_THROTTLE_MS: int('TRACKING_BROADCAST_THROTTLE_MS', 2000),

  // Heartbeat timeouts
  MODBUSGO_HEARTBEAT_TIMEOUT: int('MODBUSGO_HEARTBEAT_TIMEOUT', 60000),
  LORA_HEARTBEAT_TIMEOUT: int('LORA_HEARTBEAT_TIMEOUT', 120000),

  // Internal
  API_BASE_URL: need('API_BASE_URL', 'http://localhost:5002'),

  // Provisioning
  PROVISIONING_NONCE_TTL_MIN: int('PROVISIONING_NONCE_TTL_MIN', 1440),

  // Rate limit
  RATE_LIMIT_WINDOW_MS: int('RATE_LIMIT_WINDOW_MS', 900000),
  RATE_LIMIT_MAX_REQUESTS: int('RATE_LIMIT_MAX_REQUESTS', 1000),
};

console.log(
  `[env] ✓ Loaded — NODE_ENV=${env.NODE_ENV}, PORT=${env.PORT}, TZ=${env.TIMEZONE}, MQTT=${env.MQTT.ENABLED ? 'ON' : 'OFF'}`
);