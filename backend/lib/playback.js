// lib/playback.js
// Manage dynamic playback_{device_id} tables.
// One table per device. Created on-demand. Inserts via raw SQL (Prisma doesn't
// model dynamic tables).

import prisma from './prisma.js';

// =====================================================================
// CONSTANTS
// =====================================================================
const TABLE_PREFIX = 'playback_';
const MAX_TABLE_LEN = 64; // MySQL limit

// In-memory set of confirmed-existing tables (so we don't run CREATE TABLE
// on every insert). Cleared on server restart; first insert re-checks DB.
const knownTables = new Set();

// =====================================================================
// HELPERS
// =====================================================================

/**
 * Sanitize device_id into safe MySQL table suffix.
 * Allows: a-z, A-Z, 0-9, underscore. Replaces others with _.
 */
function sanitizeDeviceId(deviceId) {
  if (!deviceId) throw new Error('device_id required');
  const clean = String(deviceId).replace(/[^a-zA-Z0-9_]/g, '_');
  if (!clean) throw new Error('device_id sanitized to empty');
  return clean;
}

export function tableNameFor(deviceId) {
  const safe = sanitizeDeviceId(deviceId);
  const name = `${TABLE_PREFIX}${safe}`;
  if (name.length > MAX_TABLE_LEN) {
    // Truncate but keep prefix
    return name.substring(0, MAX_TABLE_LEN);
  }
  return name;
}

// =====================================================================
// DDL
// =====================================================================

const CREATE_TABLE_SQL = (tableName) => `
CREATE TABLE IF NOT EXISTS \`${tableName}\` (
  id            BIGINT       AUTO_INCREMENT PRIMARY KEY,
  device_id     VARCHAR(100) NOT NULL,
  latitude      DOUBLE       NULL,
  longitude     DOUBLE       NULL,
  speed         FLOAT        NULL,
  heading       FLOAT        NULL,
  accuracy      FLOAT        NULL,
  cpu_temp      FLOAT        NULL,
  battery_level TINYINT      NULL,
  sensor_data   JSON         NULL,
  status_live   VARCHAR(20)  NULL,
  send_dt       TIMESTAMP    NULL,
  received_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_send_dt (send_dt),
  INDEX idx_device_send (device_id, send_dt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

/**
 * Ensure table exists. Called before insert. Cached in memory after first call.
 */
export async function ensurePlaybackTable(deviceId) {
  const table = tableNameFor(deviceId);
  if (knownTables.has(table)) return table;

  await prisma.$executeRawUnsafe(CREATE_TABLE_SQL(table));
  knownTables.add(table);
  return table;
}

/**
 * Pre-warm cache by querying information_schema.
 * Call on server startup (parallel with cache loading).
 */
export async function loadKnownPlaybackTables() {
  knownTables.clear();
  const rows = await prisma.$queryRaw`
    SELECT TABLE_NAME as name
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME LIKE ${TABLE_PREFIX + '%'}
  `;
  for (const r of rows) {
    knownTables.add(r.name);
  }
  console.log(`[playback] ✓ Discovered ${knownTables.size} existing tables`);
  return knownTables.size;
}

// =====================================================================
// INSERT
// =====================================================================

/**
 * Insert one playback row. Auto-creates table if missing.
 *
 * @param {string} deviceId
 * @param {object} row - shape from toPlaybackRow()
 */
export async function insertPlaybackRow(deviceId, row) {
  const table = await ensurePlaybackTable(deviceId);

  // Raw SQL — backticks around table name (already sanitized)
  await prisma.$executeRawUnsafe(
    `INSERT INTO \`${table}\`
      (device_id, latitude, longitude, speed, heading, accuracy,
       cpu_temp, battery_level, sensor_data, status_live, send_dt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    row.device_id,
    row.latitude,
    row.longitude,
    row.speed,
    row.heading ?? null,
    row.accuracy ?? null,
    row.cpu_temp,
    row.battery_level,
    row.sensor_data, // already stringified by toPlaybackRow()
    row.status_live,
    row.send_dt
  );
}

// =====================================================================
// QUERY
// =====================================================================

/**
 * Query playback rows for a device within date range.
 *
 * @param {string} deviceId
 * @param {Date} from
 * @param {Date} to
 * @param {{limit?: number, order?: 'asc'|'desc'}} opts
 * @returns {Promise<Array>}
 */
export async function queryPlayback(deviceId, from, to, opts = {}) {
  const table = tableNameFor(deviceId);
  if (!knownTables.has(table)) return []; // table doesn't exist → no data

  const limit = Math.min(opts.limit || 5000, 50000);
  const order = opts.order === 'desc' ? 'DESC' : 'ASC';

  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, device_id, latitude, longitude, speed, heading, accuracy,
            cpu_temp, battery_level, sensor_data, status_live, send_dt, received_at
     FROM \`${table}\`
     WHERE send_dt BETWEEN ? AND ?
     ORDER BY send_dt ${order}
     LIMIT ?`,
    from,
    to,
    limit
  );

  // Parse sensor_data JSON
  return rows.map((r) => ({
    ...r,
    sensor_data: typeof r.sensor_data === 'string' ? safeJsonParse(r.sensor_data) : r.sensor_data,
  }));
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/**
 * Count rows in range (lightweight — used for "any data?" check).
 */
export async function countPlayback(deviceId, from, to) {
  const table = tableNameFor(deviceId);
  if (!knownTables.has(table)) return 0;

  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) as n FROM \`${table}\` WHERE send_dt BETWEEN ? AND ?`,
    from,
    to
  );
  return Number(rows[0]?.n || 0);
}

/**
 * Get oldest and newest send_dt — for date picker bounds in UI.
 */
export async function getPlaybackBounds(deviceId) {
  const table = tableNameFor(deviceId);
  if (!knownTables.has(table)) return { earliest: null, latest: null, count: 0 };

  const rows = await prisma.$queryRawUnsafe(
    `SELECT MIN(send_dt) as earliest, MAX(send_dt) as latest, COUNT(*) as n
     FROM \`${table}\``
  );
  return {
    earliest: rows[0]?.earliest || null,
    latest: rows[0]?.latest || null,
    count: Number(rows[0]?.n || 0),
  };
}

// =====================================================================
// MAINTENANCE
// =====================================================================

/**
 * Delete rows older than `before`. Used by retention manager.
 */
export async function purgeOldPlayback(deviceId, before) {
  const table = tableNameFor(deviceId);
  if (!knownTables.has(table)) return 0;

  const result = await prisma.$executeRawUnsafe(
    `DELETE FROM \`${table}\` WHERE send_dt < ?`,
    before
  );
  return Number(result);
}

/**
 * Drop entire playback table — when device is deleted.
 */
export async function dropPlaybackTable(deviceId) {
  const table = tableNameFor(deviceId);
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS \`${table}\``);
  knownTables.delete(table);
  return true;
}

/**
 * List all known playback tables. Useful for ops scripts.
 */
export function listKnownTables() {
  return Array.from(knownTables);
}

export function getKnownTableCount() {
  return knownTables.size;
}