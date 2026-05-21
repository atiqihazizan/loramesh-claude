// lib/playback.js
// Urus dynamic playback_{device_id} tables.
// Setiap device ada satu table. Partition by MONTH ikut received_at.
//
// KENAPA PARTITION BY MONTH:
//   - Query julat tarikh hanya scan partition bulan berkenaan (partition pruning)
//   - Walaupun device ada juta-juta baris, query sebulan tetap laju
//   - Retention: DROP PARTITION bulan lama (pantas, tak perlu DELETE baris)
//   - Data TIDAK dibuang oleh partition — partition cuma cara susun
//
// PARTITION KEY = received_at (server clock, tak pernah null).
// PRIMARY KEY = (id, received_at) — MySQL syaratkan partition key
//   mesti sebahagian primary key.

import prisma from './prisma.js';

const TABLE_PREFIX = 'playback_';
const MAX_TABLE_LEN = 64;

// Cache nama table yang sah wujud (elak CREATE TABLE setiap insert)
const knownTables = new Set();

// =====================================================================
// HELPERS
// =====================================================================

function sanitizeDeviceId(deviceId) {
  if (!deviceId) throw new Error('device_id required');
  const clean = String(deviceId).replace(/[^a-zA-Z0-9_]/g, '_');
  if (!clean) throw new Error('device_id sanitized jadi kosong');
  return clean;
}

export function tableNameFor(deviceId) {
  const name = `${TABLE_PREFIX}${sanitizeDeviceId(deviceId)}`;
  return name.length > MAX_TABLE_LEN ? name.substring(0, MAX_TABLE_LEN) : name;
}

/**
 * Nama partition untuk satu tarikh: pYYYYMM (cth p202605 untuk Mei 2026).
 */
function partitionName(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `p${y}${m}`;
}

/**
 * TO_DAYS untuk hari PERTAMA bulan SELEPAS date.
 * Partition "VALUES LESS THAN" guna nilai ni.
 */
function partitionBoundary(date) {
  const y = date.getFullYear();
  const m = date.getMonth(); // 0-indexed
  // Hari pertama bulan seterusnya
  const next = new Date(y, m + 1, 1);
  return toDays(next);
}

/** Tiru fungsi MySQL TO_DAYS — hari sejak tahun 0. */
function toDays(date) {
  // MySQL TO_DAYS('0000-01-01') = 1; guna formula yang sama
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  // Algoritma standard hari Julian-ish yang MySQL guna
  let a = Math.floor((14 - m) / 12);
  let yy = y + 4800 - a;
  let mm = m + 12 * a - 3;
  const jdn =
    d +
    Math.floor((153 * mm + 2) / 5) +
    365 * yy +
    Math.floor(yy / 4) -
    Math.floor(yy / 100) +
    Math.floor(yy / 400) -
    32045;
  // Offset supaya padan dengan TO_DAYS MySQL
  return jdn - 1721060;
}

// =====================================================================
// DDL — CIPTA TABLE BERPARTITION
// =====================================================================

/**
 * Cipta table playback berpartition month. Mula dengan partition bulan ini
 * + bulan depan, plus partition pMAX untuk tangkap apa-apa yang lebih jauh.
 */
function createTableSql(tableName) {
  const now = new Date();
  const thisMonth = now;
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const pThis = partitionName(thisMonth);
  const pNext = partitionName(nextMonth);
  const bThis = partitionBoundary(thisMonth);
  const bNext = partitionBoundary(nextMonth);

  return `
CREATE TABLE IF NOT EXISTS \`${tableName}\` (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
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
  motion_status VARCHAR(20)  NULL,
  send_dt       TIMESTAMP    NULL,
  received_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id, received_at),
  INDEX idx_send_dt (send_dt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
PARTITION BY RANGE (TO_DAYS(received_at)) (
  PARTITION ${pThis} VALUES LESS THAN (${bThis}),
  PARTITION ${pNext} VALUES LESS THAN (${bNext}),
  PARTITION pMAX VALUES LESS THAN MAXVALUE
)`;
}

/**
 * Pastikan table wujud. Cache dalam memori selepas first call.
 */
export async function ensurePlaybackTable(deviceId) {
  const table = tableNameFor(deviceId);
  if (knownTables.has(table)) return table;

  await prisma.$executeRawUnsafe(createTableSql(table));
  knownTables.add(table);

  // Daftar dalam playback_metadata
  await prisma.$executeRawUnsafe(
    `INSERT INTO playback_metadata (device_id, table_name, retention_months)
     VALUES (?, ?, 60)
     ON DUPLICATE KEY UPDATE table_name = VALUES(table_name)`,
    deviceId,
    table
  );

  return table;
}

/**
 * Pre-warm cache — discover semua playback table sedia ada.
 */
export async function loadKnownPlaybackTables() {
  knownTables.clear();
  const rows = await prisma.$queryRaw`
    SELECT TABLE_NAME as name
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME LIKE ${TABLE_PREFIX + '%'}
      AND TABLE_NAME != 'playback_metadata'
  `;
  for (const r of rows) knownTables.add(r.name);
  console.log(`[playback] ✓ Discovered ${knownTables.size} tables`);
  return knownTables.size;
}

// =====================================================================
// PARTITION MAINTENANCE
// =====================================================================

/**
 * Pastikan partition untuk bulan ini + 2 bulan ke depan wujud.
 * Dipanggil oleh job bulanan supaya data baru ada "laci" sebelum sampai.
 *
 * Cara: split partition pMAX jadi partition bulan baru + pMAX baru.
 */
export async function ensureMonthlyPartitions(deviceId) {
  const table = tableNameFor(deviceId);
  if (!knownTables.has(table)) return;

  // Senarai partition sedia ada
  const existing = await prisma.$queryRawUnsafe(
    `SELECT PARTITION_NAME as name
     FROM information_schema.PARTITIONS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       AND PARTITION_NAME IS NOT NULL`,
    table
  );
  const have = new Set(existing.map((r) => r.name));

  const now = new Date();
  // Bulan ini + 2 bulan depan
  for (let i = 0; i <= 2; i++) {
    const month = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const pName = partitionName(month);
    if (have.has(pName)) continue;

    const boundary = partitionBoundary(month);
    try {
      // Reorganize pMAX → partition baru + pMAX baru
      await prisma.$executeRawUnsafe(
        `ALTER TABLE \`${table}\` REORGANIZE PARTITION pMAX INTO (
           PARTITION ${pName} VALUES LESS THAN (${boundary}),
           PARTITION pMAX VALUES LESS THAN MAXVALUE
         )`
      );
      console.log(`[playback] + partition ${pName} untuk ${table}`);
    } catch (e) {
      // Kemungkinan partition dah wujud / boundary bertindih — abai
      if (!String(e.message).includes('REORGANIZE')) {
        console.warn(`[playback] partition ${pName} skip: ${e.message}`);
      }
    }
  }
}

/**
 * Drop partition lebih lama dari `months` bulan. Retention.
 * INI BUANG DATA — guna dengan hati-hati. Untuk demo, tidak dipanggil auto.
 */
export async function dropOldPartitions(deviceId, months) {
  const table = tableNameFor(deviceId);
  if (!knownTables.has(table)) return 0;

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const cutoffName = partitionName(cutoff);

  const partitions = await prisma.$queryRawUnsafe(
    `SELECT PARTITION_NAME as name
     FROM information_schema.PARTITIONS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       AND PARTITION_NAME IS NOT NULL AND PARTITION_NAME != 'pMAX'`,
    table
  );

  let dropped = 0;
  for (const p of partitions) {
    // Nama partition pYYYYMM — banding string terus boleh
    if (p.name < cutoffName) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE \`${table}\` DROP PARTITION ${p.name}`
      );
      console.log(`[playback] - DROP partition ${p.name} dari ${table}`);
      dropped++;
    }
  }
  return dropped;
}

// =====================================================================
// INSERT
// =====================================================================

export async function insertPlaybackRow(deviceId, row) {
  const table = await ensurePlaybackTable(deviceId);

  await prisma.$executeRawUnsafe(
    `INSERT INTO \`${table}\`
      (device_id, latitude, longitude, speed, heading, accuracy,
       cpu_temp, battery_level, sensor_data, status_live, motion_status, send_dt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    row.device_id,
    row.latitude,
    row.longitude,
    row.speed,
    row.heading ?? null,
    row.accuracy ?? null,
    row.cpu_temp,
    row.battery_level,
    row.sensor_data,
    row.status_live,
    row.motion_status ?? null,
    row.send_dt
  );
}

// =====================================================================
// QUERY
// =====================================================================

export async function queryPlayback(deviceId, from, to, opts = {}) {
  const table = tableNameFor(deviceId);
  if (!knownTables.has(table)) return [];

  const limit = Math.min(opts.limit || 5000, 50000);
  const order = opts.order === 'desc' ? 'DESC' : 'ASC';

  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, device_id, latitude, longitude, speed, heading, accuracy,
            cpu_temp, battery_level, sensor_data, status_live, motion_status,
            send_dt, received_at
     FROM \`${table}\`
     WHERE send_dt BETWEEN ? AND ?
     ORDER BY send_dt ${order}
     LIMIT ?`,
    from,
    to,
    limit
  );

  return rows.map((r) => ({
    ...r,
    sensor_data:
      typeof r.sensor_data === 'string' ? safeJsonParse(r.sensor_data) : r.sensor_data,
  }));
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

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

export async function dropPlaybackTable(deviceId) {
  const table = tableNameFor(deviceId);
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS \`${table}\``);
  await prisma.$executeRawUnsafe(
    `DELETE FROM playback_metadata WHERE device_id = ?`,
    deviceId
  );
  knownTables.delete(table);
  return true;
}

/**
 * Sync playback_metadata — kira semula jumlah baris + tarikh.
 * Dipanggil berkala atau selepas operasi besar.
 */
export async function syncPlaybackMetadata(deviceId) {
  const table = tableNameFor(deviceId);
  if (!knownTables.has(table)) return;
  const b = await getPlaybackBounds(deviceId);
  await prisma.$executeRawUnsafe(
    `UPDATE playback_metadata
     SET record_count = ?, oldest_record = ?, newest_record = ?, updated_at = NOW()
     WHERE device_id = ?`,
    b.count,
    b.earliest,
    b.latest,
    deviceId
  );
}

export function listKnownTables() {
  return Array.from(knownTables);
}

export function getKnownTableCount() {
  return knownTables.size;
}
