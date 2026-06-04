// lib/live-tracking-write.js
// Tulis live_tracking + devices — termasuk offline status-only vs snapshot penuh.

import prisma from './prisma.js';
import { STATUS_LIVE } from '../config/constants.js';
import { updateDeviceInCache } from './cache/device-cache.js';

export function hasLiveCoords(latitude, longitude) {
  return latitude != null && longitude != null;
}

export function rawPayloadHasExplicitStatus(raw) {
  if (!raw || typeof raw !== 'object') return false;
  const v = raw.status_live ?? raw.status;
  return v !== undefined && v !== null && v !== '';
}

/**
 * Simpan snapshot tracking ke DB.
 * Offline tanpa lat/lon dalam payload → kemas kini status_live/status sahaja.
 */
export async function persistLiveTrackingSnapshot({ liveRow, data, staticStatus }) {
  const isOffline = liveRow.status_live === STATUS_LIVE.OFFLINE;
  const payloadHasCoords = hasLiveCoords(liveRow.latitude, liveRow.longitude);

  if (isOffline && !payloadHasCoords) {
    await prisma.live_tracking.upsert({
      where: { device_id: liveRow.device_id },
      create: {
        device_id: liveRow.device_id,
        agency_id: liveRow.agency_id,
        device_type_id: liveRow.device_type_id,
        status_live: STATUS_LIVE.OFFLINE,
        received_at: liveRow.received_at,
      },
      update: {
        status_live: STATUS_LIVE.OFFLINE,
        received_at: liveRow.received_at,
      },
    });
    await prisma.devices.updateMany({
      where: { device_id: liveRow.device_id },
      data: { status: STATUS_LIVE.OFFLINE },
    });
    updateDeviceInCache(liveRow.device_id, { status: STATUS_LIVE.OFFLINE });
    return { mode: 'status_only' };
  }

  await prisma.live_tracking.upsert({
    where: { device_id: liveRow.device_id },
    create: liveRow,
    update: {
      agency_id: liveRow.agency_id,
      device_type_id: liveRow.device_type_id,
      latitude: liveRow.latitude,
      longitude: liveRow.longitude,
      speed: liveRow.speed,
      heading: liveRow.heading,
      accuracy: liveRow.accuracy,
      status_live: liveRow.status_live,
      motion_status: liveRow.motion_status,
      cpu_temp: liveRow.cpu_temp,
      battery_level: liveRow.battery_level,
      transmission_type: liveRow.transmission_type,
      device_model: liveRow.device_model,
      device_os: liveRow.device_os,
      sensor_data: liveRow.sensor_data,
      send_dt: liveRow.send_dt,
      node_dt: liveRow.node_dt,
      received_at: liveRow.received_at,
    },
  });

  await prisma.devices.updateMany({
    where: { device_id: data.device_id },
    data: {
      last_seen_at: data.received_at,
      status: data.status_live,
      send_dt: data.send_dt,
      node_dt: data.node_dt,
      cpu_temp: data.cpu_temp,
      speed: data.speed,
      heading: data.heading,
      ...(staticStatus?.is_static
        ? {}
        : { latitude: data.latitude, longitude: data.longitude }),
    },
  });

  updateDeviceInCache(data.device_id, { status: data.status_live });
  return { mode: 'full' };
}

/**
 * Timeout / server-side offline — guna snapshot DB semasa.
 */
export async function persistServerTimeoutOffline(liveRow) {
  if (!liveRow || liveRow.status_live === STATUS_LIVE.OFFLINE) {
    return { applied: false, reason: 'already_offline_or_missing' };
  }

  const received_at = new Date();
  const hasCoords = hasLiveCoords(liveRow.latitude, liveRow.longitude);

  if (hasCoords) {
    await prisma.live_tracking.update({
      where: { device_id: liveRow.device_id },
      data: {
        status_live: STATUS_LIVE.OFFLINE,
        received_at,
      },
    });
    await prisma.devices.updateMany({
      where: { device_id: liveRow.device_id },
      data: {
        status: STATUS_LIVE.OFFLINE,
        last_seen_at: received_at,
      },
    });
    updateDeviceInCache(liveRow.device_id, { status: STATUS_LIVE.OFFLINE });
    return { applied: true, mode: 'full', received_at, snapshot: liveRow };
  }

  await prisma.live_tracking.update({
    where: { device_id: liveRow.device_id },
    data: { status_live: STATUS_LIVE.OFFLINE, received_at },
  });
  await prisma.devices.updateMany({
    where: { device_id: liveRow.device_id },
    data: { status: STATUS_LIVE.OFFLINE },
  });
  updateDeviceInCache(liveRow.device_id, { status: STATUS_LIVE.OFFLINE });
  return { applied: true, mode: 'status_only', received_at };
}
