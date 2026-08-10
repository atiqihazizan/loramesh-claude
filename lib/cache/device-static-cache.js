// lib/cache/device-static-cache.js
// For static devices: cache lat/lng so MQTT/Socket payload can be enriched
// without DB lookup per message. Also flags `logging_enabled` for fast skip.

import prisma from '../prisma.js';

/** Map<device_id, {is_static, latitude, longitude, name, logging_enabled}> */
const cache = new Map();

export async function loadDeviceStaticCache() {
  cache.clear();
  const devices = await prisma.devices.findMany({
    select: {
      device_id: true,
      name: true,
      is_static: true,
      logging_enabled: true,
      latitude: true,
      longitude: true,
    },
  });
  for (const d of devices) {
    cache.set(d.device_id, {
      is_static: d.is_static,
      latitude: d.latitude,
      longitude: d.longitude,
      name: d.name,
      logging_enabled: d.logging_enabled,
    });
  }
  console.log(`[cache:device-static] ✓ Loaded ${cache.size} entries`);
  return cache.size;
}

export function getDeviceStaticStatus(deviceId) {
  if (!deviceId) return null;
  return cache.get(deviceId) || null;
}

/**
 * Update single entry. Partial merge.
 */
export function updateDeviceStaticStatus(deviceId, partial) {
  if (!deviceId) return;
  const existing = cache.get(deviceId);
  if (!existing) {
    cache.set(deviceId, {
      is_static: false,
      latitude: null,
      longitude: null,
      name: null,
      logging_enabled: true,
      ...partial,
    });
  } else {
    cache.set(deviceId, { ...existing, ...partial });
  }
}

export function removeDeviceStaticFromCache(deviceId) {
  cache.delete(deviceId);
}

export function getCacheSize() {
  return cache.size;
}