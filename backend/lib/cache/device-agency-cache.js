// lib/cache/device-agency-cache.js
// Map device_id → Set<agency_id> for fast routing of incoming MQTT/Socket data.
// One device can belong to multiple agencies (via device_agency join table).
// Paksi routing: agency_id (bukan agency_token lagi).

import prisma from '../prisma.js';

/** Map<device_id, Set<agency_id>> */
const cache = new Map();

export async function loadDeviceAgencyCache() {
  cache.clear();
  const rows = await prisma.device_agency.findMany({
    where: { active: true },
    include: {
      device: { select: { device_id: true } },
      agency: { select: { id: true, status: true } },
    },
  });

  for (const r of rows) {
    if (!r.agency?.status) continue;          // skip inactive agencies
    if (!r.device?.device_id) continue;       // safety
    const did = r.device.device_id;
    const aid = r.agency.id;
    if (!cache.has(did)) cache.set(did, new Set());
    cache.get(did).add(aid);
  }
  console.log(`[cache:device-agency] ✓ Loaded ${cache.size} device mappings`);
  return cache.size;
}

/**
 * Get all agency ids that this device belongs to.
 * @returns {number[]}
 */
export function getAgencyIdsByDeviceId(deviceId) {
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
export function assignDeviceToAgencyInCache(deviceId, agencyId) {
  if (!deviceId || agencyId == null) return;
  if (!cache.has(deviceId)) cache.set(deviceId, new Set());
  cache.get(deviceId).add(agencyId);
}

/**
 * Called when device removed from agency.
 */
export function unassignDeviceFromAgencyInCache(deviceId, agencyId) {
  const set = cache.get(deviceId);
  if (!set) return;
  set.delete(agencyId);
  if (set.size === 0) cache.delete(deviceId);
}

export function getCacheSize() {
  return cache.size;
}