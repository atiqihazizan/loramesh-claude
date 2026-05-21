// lib/cache/device-cache.js
// Cache of device metadata. Lookup by device_id.
// Used by tracking pipeline to enrich incoming data with name, type, etc.

import prisma from '../prisma.js';

/** Map<device_id, deviceObject> */
const cache = new Map();

export async function loadDeviceCache() {
  cache.clear();
  const devices = await prisma.devices.findMany({
    select: {
      id: true,
      device_id: true,
      device_mac: true,
      name: true,
      type_id: true,
      data_type: true,
      is_static: true,
      logging_enabled: true,
      latitude: true,
      longitude: true,
    },
  });
  for (const d of devices) {
    cache.set(d.device_id, d);
  }
  console.log(`[cache:device] ✓ Loaded ${cache.size} devices`);
  return cache.size;
}

export function getDeviceByDeviceId(deviceId) {
  if (!deviceId) return null;
  return cache.get(deviceId) || null;
}

/**
 * Upsert into cache. If device doesn't exist, add it with minimal fields.
 */
export function updateDeviceInCache(deviceId, partial) {
  if (!deviceId) return;
  const existing = cache.get(deviceId);
  if (!existing) {
    cache.set(deviceId, { device_id: deviceId, ...partial });
  } else {
    cache.set(deviceId, { ...existing, ...partial });
  }
}

export function removeDeviceFromCache(deviceId) {
  cache.delete(deviceId);
}

export function getCacheSize() {
  return cache.size;
}