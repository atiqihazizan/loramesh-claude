// jobs/heartbeat-watchdog.js
// Tanda device 'offline' kalau dah lama tak hantar data.
// Berjalan berkala (interval) — dipanggil dari server.js.

import prisma from '../lib/prisma.js';
import { env } from '../config/env.js';
import { STATUS_LIVE } from '../config/constants.js';
import { getDeviceTypeById } from '../lib/cache/device-type-cache.js';
import { getIO } from '../realtime/socket-server.js';

let intervalRef = null;

/**
 * Satu pusingan check — cari device yang status online/idle tapi dah lama senyap.
 */
async function runHeartbeatCheck() {
  const now = Date.now();

  // Ambil semua live_tracking yang status bukan offline
  const liveRows = await prisma.live_tracking.findMany({
    where: { status_live: { not: STATUS_LIVE.OFFLINE } },
    select: {
      device_id: true,
      agency_id: true,
      status_live: true,
      device_type_id: true,
      updated_at: true,
      received_at: true,
    },
  });

  let markedOffline = 0;

  for (const row of liveRows) {
    // Tentukan timeout ikut jenis device.
    // Mobile (MG) guna timeout pendek; LoRa/Gateway guna panjang.
    const dt = getDeviceTypeById(row.device_type_id);
    const isMobile = dt?.code === 'MG';
    const timeout = isMobile
      ? env.MODBUSGO_HEARTBEAT_TIMEOUT
      : env.LORA_HEARTBEAT_TIMEOUT;

    const lastSeen = row.received_at ? new Date(row.received_at).getTime() : 0;
    if (now - lastSeen > timeout) {
      // Dah tamat tempoh — tanda offline
      await prisma.live_tracking.update({
        where: { device_id: row.device_id },
        data: { status_live: STATUS_LIVE.OFFLINE },
      });
      await prisma.devices.updateMany({
        where: { device_id: row.device_id },
        data: { status: STATUS_LIVE.OFFLINE },
      });

      // Broadcast status change ke frontend
      const io = getIO();
      if (io) {
        io.to(`agency:${row.agency_id}`).emit('device:status', {
          device_id: row.device_id,
          status_live: STATUS_LIVE.OFFLINE,
          reason: 'heartbeat_timeout',
        });
      }
      markedOffline++;
    }
  }

  if (markedOffline > 0) {
    console.log(`[heartbeat] ${markedOffline} device ditanda offline`);
  }
}

/**
 * Mula watchdog — check setiap `intervalMs`.
 */
export function startHeartbeatWatchdog(intervalMs = 30000) {
  if (intervalRef) return;
  console.log(`[heartbeat] ✓ Watchdog dimulakan (setiap ${intervalMs / 1000}s)`);
  intervalRef = setInterval(() => {
    runHeartbeatCheck().catch((err) => {
      console.error('[heartbeat] Error:', err.message);
    });
  }, intervalMs);
}

export function stopHeartbeatWatchdog() {
  if (intervalRef) {
    clearInterval(intervalRef);
    intervalRef = null;
  }
}
