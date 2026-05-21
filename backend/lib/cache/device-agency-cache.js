// lib/cache/device-agency-cache.js
// Map device_id → [agency_token, ...] for fast routing of incoming MQTT/Socket data.
// One device can belong to multiple agencies (via device_agency join table).

import prisma from '../prisma.js';

/** Map<device_id, Set<agency_token>> */
const cache = new Map();

export async function loadDeviceAgencyCache() {
  cache.clear();
  const rows = await prisma.device_agency.findMany({
    where: { active: true },
    include: {
      device: { select: { device_id: true } },
      agency: { select: { agency_token: true, status: true } },
    },
  });

  for (const r of rows) {
    if (!r.agency?.status) continue;          // skip inactive agencies
    if (!r.device?.device_id) continue;       // safety
    const did = r.device.device_id;
    const token = r.agency.agency_token;
    if (!cache.has(did)) cache.set(did, new Set());
    cache.get(did).add(token);
  }
  console.log(`[cache:device-agency] ✓ Loaded ${cache.size} device mappings`);
  return cache.size;
}

/**
 * Get all agency tokens that this device belongs to.
 * @returns {string[]}
 */
export function getAgencyTokensByDeviceId(deviceId) {
  if (!deviceId) return [];
  const set = cache.get(deviceId);
  return set ? Array.from(set) : [];
}

export function hasDeviceInCache(deviceId) {
  return !!deviceId && cache.has(deviceId);
}

/**
 * Called when device is assigned to an agency (via /api/devices or admin UI).
 */
export function assignDeviceToAgencyInCache(deviceId, agencyToken) {
  if (!deviceId || !agencyToken) return;
  if (!cache.has(deviceId)) cache.set(deviceId, new Set());
  cache.get(deviceId).add(agencyToken);
}

/**
 * Called when device removed from agency.
 */
export function unassignDeviceFromAgencyInCache(deviceId, agencyToken) {
  const set = cache.get(deviceId);
  if (!set) return;
  set.delete(agencyToken);
  if (set.size === 0) cache.delete(deviceId);
}

export function getCacheSize() {
  return cache.size;
}