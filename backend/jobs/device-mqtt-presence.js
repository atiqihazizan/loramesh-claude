// jobs/device-mqtt-presence.js
// Timer per device: offline selepas tiada MQTT (device berdaftar) melebihi timeout.
// Setiap mesej MQTT yang lulus pipeline → reset timer (bukan poll DB berkala).

import prisma from '../lib/prisma.js';
import { env } from '../config/env.js';
import { STATUS_LIVE } from '../config/constants.js';
import { getDeviceTypeById } from '../lib/cache/device-type-cache.js';
import { getAgencyIdsByDeviceId } from '../lib/cache/device-agency-cache.js';
import { getDeviceByDeviceId } from '../lib/cache/device-cache.js';
import { persistServerTimeoutOffline } from '../lib/live-tracking-write.js';
import { getIO } from '../realtime/socket-server.js';

/** @type {Map<string, { timer: NodeJS.Timeout, deviceTypeId: number|null, agencyIds: number[] }>} */
const presenceByDevice = new Map();

function getHeartbeatTimeoutMs(deviceTypeId) {
  const dt = deviceTypeId != null ? getDeviceTypeById(deviceTypeId) : null;
  const isMobile = dt?.code === 'MG';
  return isMobile ? env.MODBUSGO_HEARTBEAT_TIMEOUT : env.LORA_HEARTBEAT_TIMEOUT;
}

function clearDeviceTimer(deviceId) {
  const entry = presenceByDevice.get(deviceId);
  if (entry?.timer) clearTimeout(entry.timer);
  if (entry) entry.timer = null;
}

async function onPresenceTimeout(deviceId) {
  const entry = presenceByDevice.get(deviceId);
  if (!entry) return;

  const agencyIds = getAgencyIdsByDeviceId(deviceId);
  if (agencyIds.length === 0) {
    presenceByDevice.delete(deviceId);
    return;
  }

  try {
    const liveRow = await prisma.live_tracking.findUnique({
      where: { device_id: deviceId },
    });
    if (!liveRow || liveRow.status_live === STATUS_LIVE.OFFLINE) {
      return;
    }

    const result = await persistServerTimeoutOffline(liveRow);
    if (!result.applied) return;

    const io = getIO();
    if (!io) return;

    const deviceMeta = getDeviceByDeviceId(deviceId) || {};

    for (const agencyId of agencyIds) {
      if (result.mode === 'full') {
        io.to(`agency:${agencyId}`).emit('device:update', {
          device_id: deviceId,
          device_type_id: liveRow.device_type_id,
          name: deviceMeta.name || null,
          is_static: deviceMeta.is_static || false,
          latitude: liveRow.latitude,
          longitude: liveRow.longitude,
          speed: liveRow.speed,
          heading: liveRow.heading,
          status_live: STATUS_LIVE.OFFLINE,
          motion_status: liveRow.motion_status,
          cpu_temp: liveRow.cpu_temp,
          battery_level: liveRow.battery_level,
          sensor_data: liveRow.sensor_data,
          send_dt: liveRow.send_dt,
          reason: 'mqtt_presence_timeout',
        });
      } else {
        io.to(`agency:${agencyId}`).emit('device:status', {
          device_id: deviceId,
          status_live: STATUS_LIVE.OFFLINE,
          reason: 'mqtt_presence_timeout',
        });
      }
    }

    if (env.MQTT.VERBOSE_LOG) {
      console.log(`[presence] ${deviceId} → offline (${result.mode})`);
    }
  } catch (err) {
    console.error(`[presence] timeout error (${deviceId}):`, err.message);
  } finally {
    clearDeviceTimer(deviceId);
    presenceByDevice.delete(deviceId);
  }
}

function scheduleDeviceTimer(deviceId, deviceTypeId, agencyIds) {
  clearDeviceTimer(deviceId);
  const timeoutMs = getHeartbeatTimeoutMs(deviceTypeId);
  const timer = setTimeout(() => {
    onPresenceTimeout(deviceId).catch((e) =>
      console.error(`[presence] unhandled (${deviceId}):`, e.message)
    );
  }, timeoutMs);

  const prev = presenceByDevice.get(deviceId);
  presenceByDevice.set(deviceId, {
    timer,
    deviceTypeId: deviceTypeId ?? prev?.deviceTypeId ?? null,
    agencyIds,
  });
}

/**
 * Dipanggil selepas MQTT payload device berdaftar berjaya diproses pipeline.
 * Device sudah offline — jangan jadualkan timeout.
 */
export function touchMqttPresence(deviceId, deviceTypeId, agencyIds, statusLive) {
  if (!deviceId || !Array.isArray(agencyIds) || agencyIds.length === 0) return;

  if (statusLive === STATUS_LIVE.OFFLINE) {
    clearDeviceTimer(deviceId);
    presenceByDevice.delete(deviceId);
    return;
  }

  scheduleDeviceTimer(deviceId, deviceTypeId, agencyIds);
}

async function bootstrapPresenceFromDb() {
  const rows = await prisma.live_tracking.findMany({
    where: {
      status_live: { not: STATUS_LIVE.OFFLINE },
    },
    select: {
      device_id: true,
      device_type_id: true,
      agency_id: true,
      received_at: true,
      status_live: true,
    },
  });

  const now = Date.now();
  let scheduled = 0;

  for (const row of rows) {
    const agencyIds = getAgencyIdsByDeviceId(row.device_id);
    if (agencyIds.length === 0) continue;

    const timeoutMs = getHeartbeatTimeoutMs(row.device_type_id);
    const lastMs = row.received_at ? new Date(row.received_at).getTime() : 0;
    const elapsed = now - lastMs;
    const delay = Math.max(0, timeoutMs - elapsed);

    clearDeviceTimer(row.device_id);
    const timer = setTimeout(
      () => {
        onPresenceTimeout(row.device_id).catch((e) =>
          console.error(`[presence] bootstrap timeout (${row.device_id}):`, e.message)
        );
      },
      delay === 0 ? 0 : delay
    );

    presenceByDevice.set(row.device_id, {
      timer,
      deviceTypeId: row.device_type_id,
      agencyIds,
    });
    scheduled++;
  }

  if (scheduled > 0) {
    console.log(`[presence] ✓ ${scheduled} device timer (per-device timeout)`);
  }
}

export function startHeartbeatWatchdog() {
  bootstrapPresenceFromDb().catch((err) => {
    console.error('[presence] bootstrap gagal:', err.message);
  });
}

export function stopHeartbeatWatchdog() {
  for (const [deviceId] of presenceByDevice) {
    clearDeviceTimer(deviceId);
  }
  presenceByDevice.clear();
}
