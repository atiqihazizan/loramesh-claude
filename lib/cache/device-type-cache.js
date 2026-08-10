// lib/cache/device-type-cache.js
// Cache device_type master list. Lookup by code (payload type code) and by id.

import prisma from '../prisma.js';

/** Map<code, {id, name, code, icon, color_code}> */
const byCode = new Map();
/** Map<id, {id, name, code, icon, color_code}> */
const byId = new Map();

export async function loadDeviceTypeCache() {
  byCode.clear();
  byId.clear();
  const types = await prisma.device_type.findMany({
    select: { id: true, name: true, code: true, icon: true, color_code: true },
  });
  for (const t of types) {
    const entry = {
      id: t.id,
      name: t.name,
      code: t.code,
      icon: t.icon,
      color_code: t.color_code,
    };
    if (t.code) byCode.set(t.code, entry);
    byId.set(t.id, entry);
  }
  console.log(`[cache:device-type] ✓ Loaded ${byId.size} device types`);
  return byId.size;
}

/**
 * Lookup by code (= payload type code). Returns null if not found.
 */
export function getDeviceTypeByCode(code) {
  if (!code) return null;
  return byCode.get(code) || null;
}

export function getDeviceTypeById(id) {
  if (!id) return null;
  return byId.get(id) || null;
}

export function getCacheSize() {
  return byId.size;
}
