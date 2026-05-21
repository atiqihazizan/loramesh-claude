// lib/cache/agency-cache.js
// In-memory cache of agency tokens. O(1) lookup by token.
// Loaded on startup from DB; refreshed when agency created/updated/deleted.

import prisma from '../prisma.js';

/** Map<agency_token, {agencyId, agencyCode, agencyName, status}> */
const cache = new Map();

export async function loadAgencyCache() {
  cache.clear();
  const agencies = await prisma.agency.findMany({
    where: { status: true },
    select: {
      id: true,
      code: true,
      name: true,
      agency_token: true,
      status: true,
    },
  });

  for (const a of agencies) {
    cache.set(a.agency_token, {
      agencyId: a.id,
      agencyCode: a.code,
      agencyName: a.name,
      status: a.status,
    });
  }
  console.log(`[cache:agency] ✓ Loaded ${cache.size} agencies`);
  return cache.size;
}

/**
 * Get agency context by token. Returns null if not found.
 * @param {string} token
 * @returns {{agencyId, agencyCode, agencyName, status}|null}
 */
export function getAgencyFromCache(token) {
  if (!token) return null;
  return cache.get(token) || null;
}

/**
 * Quick boolean check — does this token exist?
 */
export function validateAgencyToken(token) {
  return !!token && cache.has(token);
}

export function getAllAgencyTokens() {
  return Array.from(cache.keys());
}

/**
 * Called when a single agency is created/updated.
 * Reload just that one (or remove if deactivated).
 */
export async function refreshAgencyInCache(agencyId) {
  const a = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { id: true, code: true, name: true, agency_token: true, status: true },
  });

  // Remove old entries for this agency (by id) — token may have changed
  for (const [token, val] of cache.entries()) {
    if (val.agencyId === agencyId) cache.delete(token);
  }

  if (a && a.status) {
    cache.set(a.agency_token, {
      agencyId: a.id,
      agencyCode: a.code,
      agencyName: a.name,
      status: a.status,
    });
    console.log(`[cache:agency] ↻ Refreshed agency ${a.code}`);
  } else {
    console.log(`[cache:agency] ✗ Removed agency id=${agencyId} (deleted or inactive)`);
  }
}

export function removeAgencyFromCache(agencyId) {
  for (const [token, val] of cache.entries()) {
    if (val.agencyId === agencyId) cache.delete(token);
  }
}

export function getCacheSize() {
  return cache.size;
}