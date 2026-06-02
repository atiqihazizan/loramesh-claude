// lib/cache/agency-cache.js
// In-memory cache of agencies. Dual index:
//   - byToken: Map<agency_token, ctx>  → untuk REST APK (auth-agency-token)
//   - byId:    Map<agency_id, ctx>     → untuk routing pipeline (paksi agency_id)
// Loaded on startup from DB; refreshed when agency created/updated/deleted.

import prisma from '../prisma.js';

/** ctx = {agencyId, agencyCode, agencyName, status, agencyToken} */
const byToken = new Map();
const byId = new Map();

function setEntry(a) {
  const ctx = {
    agencyId: a.id,
    agencyCode: a.code,
    agencyName: a.name,
    status: a.status,
    agencyToken: a.agency_token,
  };
  byToken.set(a.agency_token, ctx);
  byId.set(a.id, ctx);
}

function deleteById(agencyId) {
  const ctx = byId.get(agencyId);
  if (ctx) {
    byToken.delete(ctx.agencyToken);
    byId.delete(agencyId);
  }
}

export async function loadAgencyCache() {
  byToken.clear();
  byId.clear();
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

  for (const a of agencies) setEntry(a);
  console.log(`[cache:agency] ✓ Loaded ${byId.size} agencies`);
  return byId.size;
}

/**
 * Get agency context by token. Returns null if not found.
 * Untuk laluan REST APK (auth-agency-token middleware).
 * @param {string} token
 * @returns {{agencyId, agencyCode, agencyName, status, agencyToken}|null}
 */
export function getAgencyFromCache(token) {
  if (!token) return null;
  return byToken.get(token) || null;
}

/**
 * Get agency context by agency_id. Returns null if not found.
 * Paksi routing pipeline (token → agency_id).
 * @param {number} agencyId
 * @returns {{agencyId, agencyCode, agencyName, status, agencyToken}|null}
 */
export function getAgencyById(agencyId) {
  if (agencyId == null) return null;
  return byId.get(agencyId) || null;
}

/**
 * Quick boolean check — does this token exist?
 */
export function validateAgencyToken(token) {
  return !!token && byToken.has(token);
}

export function getAllAgencyTokens() {
  return Array.from(byToken.keys());
}

export function getAllAgencyIds() {
  return Array.from(byId.keys());
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

  // Remove old entries for this agency (token may have changed)
  deleteById(agencyId);

  if (a && a.status) {
    setEntry(a);
    console.log(`[cache:agency] ↻ Refreshed agency ${a.code}`);
  } else {
    console.log(`[cache:agency] ✗ Removed agency id=${agencyId} (deleted or inactive)`);
  }
}

export function removeAgencyFromCache(agencyId) {
  deleteById(agencyId);
}

export function getCacheSize() {
  return byId.size;
}