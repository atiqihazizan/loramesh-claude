// services/tracking-service.js
// Wrapper antara REST routes dan tracking-pipeline.
// Digunakan oleh routes/nodes.js untuk ingest data via HTTP (alternatif MQTT).

import { processTracking, processTrackingBatch } from '../realtime/tracking-pipeline.js';
import { DATA_SOURCE } from '../config/constants.js';
import prisma from '../lib/prisma.js';

/**
 * Ingest satu tracking payload via REST.
 */
export async function ingestSingle(payload) {
  const result = await processTracking(payload, DATA_SOURCE.MQTT);
  return result;
}

/**
 * Ingest batch (backfill).
 */
export async function ingestBatch(payloads) {
  if (!Array.isArray(payloads)) {
    const err = new Error('Expected array of payloads');
    err.status = 400;
    throw err;
  }
  return processTrackingBatch(payloads, DATA_SOURCE.MQTT);
}

/**
 * Dapatkan snapshot live tracking untuk semua device dalam agency.
 * Digunakan masa frontend mula-mula load map (sebelum Socket updates masuk).
 */
export async function getLiveSnapshot(agencyId) {
  const rows = await prisma.live_tracking.findMany({
    where: { agency_id: agencyId },
    include: {
      device_type: {
        select: { id: true, name: true, code: true, icon: true, color_code: true },
      },
    },
  });

  // Ambil nama device dari devices table
  const deviceIds = rows.map((r) => r.device_id);
  const devices = await prisma.devices.findMany({
    where: { device_id: { in: deviceIds } },
    select: { device_id: true, name: true, is_static: true },
  });
  const deviceMap = new Map(devices.map((d) => [d.device_id, d]));

  return rows.map((r) => {
    const dev = deviceMap.get(r.device_id);
    return {
      device_id: r.device_id,
      name: dev?.name || null,
      is_static: dev?.is_static || false,
      data_type: r.device_type?.code || null,
      device_type_id: r.device_type_id,
      device_type: r.device_type,
      latitude: r.latitude,
      longitude: r.longitude,
      speed: r.speed,
      heading: r.heading,
      status_live: r.status_live,
      motion_status: r.motion_status,
      cpu_temp: r.cpu_temp,
      battery_level: r.battery_level,
      sensor_data: r.sensor_data,
      send_dt: r.send_dt,
      updated_at: r.updated_at,
    };
  });
}
