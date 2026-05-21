// services/playback-service.js
// Query historical tracking dari playback_{device_id} tables.

import prisma from '../lib/prisma.js';
import { ROLES } from '../config/constants.js';
import {
  queryPlayback,
  getPlaybackBounds,
} from '../lib/playback.js';
import { parseTrackingDate } from '../utils/date.js';

/**
 * Pastikan user boleh akses device ni (device mesti dalam agency dia).
 * Throw kalau tak.
 */
async function assertDeviceAccess(deviceId, user) {
  const device = await prisma.devices.findUnique({
    where: { device_id: deviceId },
    include: {
      device_agencies: {
        where: { active: true },
        select: { agency_id: true },
      },
    },
  });
  if (!device) {
    const err = new Error('Device not found');
    err.status = 404;
    throw err;
  }
  if (user.level.code !== ROLES.SUPERADMIN) {
    const inAgency = device.device_agencies.some(
      (da) => da.agency_id === user.agency?.id
    );
    if (!inAgency) {
      const err = new Error('Forbidden — device not in your agency');
      err.status = 403;
      throw err;
    }
  }
  return device;
}

/**
 * Bounds — tarikh terawal/terakhir + jumlah row.
 * Frontend guna untuk had date picker.
 */
export async function getBounds(deviceId, user) {
  await assertDeviceAccess(deviceId, user);
  const bounds = await getPlaybackBounds(deviceId);
  return {
    device_id: deviceId,
    earliest: bounds.earliest,
    latest: bounds.latest,
    total_points: bounds.count,
  };
}

/**
 * Query track dalam julat tarikh.
 *
 * @param {string} deviceId
 * @param {object} opts
 * @param {string|Date} opts.from
 * @param {string|Date} opts.to
 * @param {number} [opts.limit]
 * @param {string} [opts.order]  'asc'|'desc'
 */
export async function getTrack(deviceId, user, opts) {
  await assertDeviceAccess(deviceId, user);

  const from = parseTrackingDate(opts.from);
  const to = parseTrackingDate(opts.to);
  if (!from || !to) {
    const err = new Error('Invalid from/to date');
    err.status = 400;
    throw err;
  }
  if (from > to) {
    const err = new Error('from must be before to');
    err.status = 400;
    throw err;
  }

  const rows = await queryPlayback(deviceId, from, to, {
    limit: opts.limit || 5000,
    order: opts.order === 'desc' ? 'desc' : 'asc',
  });

  return {
    device_id: deviceId,
    from,
    to,
    count: rows.length,
    points: rows.map((r) => ({
      id: r.id != null ? String(r.id) : r.id,
      latitude: r.latitude,
      longitude: r.longitude,
      speed: r.speed,
      heading: r.heading,
      accuracy: r.accuracy,
      cpu_temp: r.cpu_temp,
      battery_level: r.battery_level,
      sensor_data: r.sensor_data,
      status_live: r.status_live,
      send_dt: r.send_dt,
      received_at: r.received_at,
    })),
  };
}

/**
 * Summary — ringkasan statistik untuk julat tarikh.
 * Jarak (haversine), kelajuan purata/max, tempoh.
 */
export async function getSummary(deviceId, user, opts) {
  await assertDeviceAccess(deviceId, user);

  const from = parseTrackingDate(opts.from);
  const to = parseTrackingDate(opts.to);
  if (!from || !to) {
    const err = new Error('Invalid from/to date');
    err.status = 400;
    throw err;
  }

  const rows = await queryPlayback(deviceId, from, to, {
    limit: 50000,
    order: 'asc',
  });

  if (rows.length === 0) {
    return {
      device_id: deviceId,
      from,
      to,
      total_points: 0,
      distance_km: 0,
      avg_speed: 0,
      max_speed: 0,
      duration_minutes: 0,
    };
  }

  // Kira jarak guna haversine antara titik berturut-turut
  let distanceM = 0;
  let maxSpeed = 0;
  let speedSum = 0;
  let speedCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.speed != null) {
      maxSpeed = Math.max(maxSpeed, r.speed);
      speedSum += r.speed;
      speedCount++;
    }
    if (i > 0) {
      const prev = rows[i - 1];
      if (
        prev.latitude != null && prev.longitude != null &&
        r.latitude != null && r.longitude != null
      ) {
        distanceM += haversineMeters(
          prev.latitude, prev.longitude,
          r.latitude, r.longitude
        );
      }
    }
  }

  const firstDt = rows[0].send_dt ? new Date(rows[0].send_dt) : null;
  const lastDt = rows[rows.length - 1].send_dt
    ? new Date(rows[rows.length - 1].send_dt)
    : null;
  const durationMin =
    firstDt && lastDt ? Math.round((lastDt - firstDt) / 60000) : 0;

  return {
    device_id: deviceId,
    from,
    to,
    total_points: rows.length,
    distance_km: Math.round((distanceM / 1000) * 100) / 100,
    avg_speed: speedCount > 0 ? Math.round((speedSum / speedCount) * 10) / 10 : 0,
    max_speed: Math.round(maxSpeed * 10) / 10,
    duration_minutes: durationMin,
    first_point_at: firstDt,
    last_point_at: lastDt,
  };
}

/**
 * Haversine — jarak (meter) antara dua koordinat.
 */
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // jejari bumi meter
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
