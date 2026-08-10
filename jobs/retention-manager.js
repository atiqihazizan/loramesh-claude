// jobs/retention-manager.js
// Buang playback row lama untuk jimat storan.
// DIJALANKAN MANUAL atau via cron — BUKAN auto pada server start.
//
// Guna:
//   node jobs/retention-manager.js purge 90    ← buang data lebih 90 hari
//   node jobs/retention-manager.js stats        ← tunjuk saiz setiap table
//
// Untuk demo, ini tak dipanggil automatik. Sediakan je untuk masa depan.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prisma from '../lib/prisma.js';
import { listKnownTables, loadKnownPlaybackTables, dropOldPartitions } from '../lib/playback.js';

/**
 * Buang playback row lebih lama dari `days` hari, untuk SEMUA device.
 */
export async function purgeAllOlderThan(days) {
  await loadKnownPlaybackTables();
  const tables = listKnownTables();
  const months = Math.max(1, Math.ceil(days / 30));

  console.log(`[retention] Purge partition lebih lama dari ~${months} bulan (${tables.length} tables)`);

  let totalDropped = 0;
  for (const table of tables) {
    // table name = playback_{device_id} — extract device_id
    const deviceId = table.replace(/^playback_/, '');
    try {
      const dropped = await dropOldPartitions(deviceId, months);
      totalDropped += dropped;
      if (dropped > 0) {
        console.log(`[retention]   ${table}: ${dropped} partition dibuang`);
      }
    } catch (e) {
      console.error(`[retention]   ${table}: error — ${e.message}`);
    }
  }
  console.log(`[retention] ✓ Selesai — jumlah ${totalDropped} partition dibuang`);
  return totalDropped;
}

/**
 * Tunjuk statistik — jumlah row setiap table.
 */
export async function showStats() {
  await loadKnownPlaybackTables();
  const tables = listKnownTables();
  console.log(`[retention] ${tables.length} playback tables\n`);

  for (const table of tables) {
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as n FROM \`${table}\``
      );
      console.log(`  ${table}: ${rows[0]?.n || 0} rows`);
    } catch (e) {
      console.log(`  ${table}: error`);
    }
  }
}

// --- CLI entry point ---
const __filename = fileURLToPath(import.meta.url);
const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMain) {
  const cmd = process.argv[2];
  const arg = process.argv[3];

  (async () => {
    try {
      if (cmd === 'purge') {
        const days = parseInt(arg, 10);
        if (!days || days < 1) {
          console.error('Guna: node jobs/retention-manager.js purge <days>');
          process.exit(1);
        }
        await purgeAllOlderThan(days);
      } else if (cmd === 'stats') {
        await showStats();
      } else {
        console.log('Command: purge <days> | stats');
      }
    } catch (e) {
      console.error('[retention] Gagal:', e);
    } finally {
      await prisma.$disconnect();
    }
  })();
}
