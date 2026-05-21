// services/agency-service.js
// CRUD for agencies. SUPERADMIN only.

import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import prisma from '../lib/prisma.js';
import { env } from '../config/env.js';
import { ROLES, AGENCY_DEFAULTS } from '../config/constants.js';
import {
  refreshAgencyInCache,
  removeAgencyFromCache,
} from '../lib/cache/agency-cache.js';

/**
 * Generate cryptographically random agency token.
 * 32 bytes base64-url = ~43 chars.
 */
function generateAgencyToken() {
  return crypto.randomBytes(32).toString('base64url');
}

// =====================================================================
// LIST
// =====================================================================

export async function listAgencies({ includeInactive = false } = {}) {
  const agencies = await prisma.agency.findMany({
    where: includeInactive ? {} : { status: true },
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      default_map_center: true,
      default_map_zoom: true,
      default_tile_provider: true,
      tracking_zoom_moving: true,
      tracking_zoom_stopped: true,
      tracking_stop_radius_m: true,
      session_timeout_hours: true,
      created_at: true,
      updated_at: true,
      _count: {
        select: {
          user_agencies: true,
          device_agencies: { where: { active: true } },
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  return agencies.map((a) => ({
    ...a,
    user_count: a._count.user_agencies,
    device_count: a._count.device_agencies,
    _count: undefined,
  }));
}

// =====================================================================
// GET ONE
// =====================================================================

export async function getAgencyById(id, { includeToken = false } = {}) {
  const agency = await prisma.agency.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      agency_token: includeToken,
      default_map_center: true,
      default_map_zoom: true,
      default_tile_provider: true,
      tracking_zoom_moving: true,
      tracking_zoom_stopped: true,
      tracking_stop_radius_m: true,
      session_timeout_hours: true,
      created_at: true,
      updated_at: true,
      _count: {
        select: {
          user_agencies: true,
          device_agencies: { where: { active: true } },
          sites: true,
        },
      },
    },
  });
  if (!agency) {
    const err = new Error('Agency not found');
    err.status = 404;
    throw err;
  }
  return {
    ...agency,
    user_count: agency._count.user_agencies,
    device_count: agency._count.device_agencies,
    site_count: agency._count.sites,
    _count: undefined,
  };
}

// =====================================================================
// CREATE
// =====================================================================

/**
 * Create agency + optionally create first ADMIN_AGENCY user.
 *
 * @param {object} payload
 * @param {string} payload.name
 * @param {string} payload.code
 * @param {object} [payload.admin_user]  { username, password, name?, email? }
 */
export async function createAgency(payload) {
  const { name, code, admin_user } = payload;

  // Check uniqueness
  const existing = await prisma.agency.findUnique({ where: { code } });
  if (existing) {
    const err = new Error('Agency code already exists');
    err.status = 409;
    throw err;
  }

  const token = generateAgencyToken();

  const result = await prisma.$transaction(async (tx) => {
    const agency = await tx.agency.create({
      data: {
        name,
        code,
        agency_token: token,
        status: true,
        default_map_center: AGENCY_DEFAULTS.MAP_CENTER,
        default_map_zoom: AGENCY_DEFAULTS.MAP_ZOOM,
        default_tile_provider: AGENCY_DEFAULTS.TILE_PROVIDER,
        tracking_zoom_moving: AGENCY_DEFAULTS.TRACKING_ZOOM_MOVING,
        tracking_zoom_stopped: AGENCY_DEFAULTS.TRACKING_ZOOM_STOPPED,
        tracking_stop_radius_m: AGENCY_DEFAULTS.TRACKING_STOP_RADIUS_M,
      },
    });

    let createdAdmin = null;
    if (admin_user) {
      const { username, password, name: adminName, email } = admin_user;

      // Uniqueness check
      const exists = await tx.users.findUnique({ where: { username } });
      if (exists) {
        const err = new Error(`Admin username "${username}" already exists`);
        err.status = 409;
        throw err;
      }

      const adminLevel = await tx.level.findUnique({
        where: { code: ROLES.ADMIN_AGENCY },
      });
      if (!adminLevel) {
        throw new Error('ADMIN_AGENCY level missing — run seed');
      }

      const hash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
      const user = await tx.users.create({
        data: {
          username,
          password: hash,
          name: adminName || null,
          email: email || null,
          level_id: adminLevel.id,
          status: 'offline',
          password_changed_at: new Date(),
        },
      });
      await tx.user_agency.create({
        data: { user_id: user.id, agency_id: agency.id },
      });
      createdAdmin = {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
      };
    }

    return { agency, admin: createdAdmin };
  });

  await refreshAgencyInCache(result.agency.id);

  return {
    id: result.agency.id,
    code: result.agency.code,
    name: result.agency.name,
    status: result.agency.status,
    agency_token: result.agency.agency_token,
    admin_user: result.admin,
  };
}

// =====================================================================
// UPDATE
// =====================================================================

export async function updateAgency(id, patch) {
  const allowed = {};
  if (patch.name !== undefined) allowed.name = patch.name;
  if (patch.code !== undefined) allowed.code = patch.code;
  if (patch.status !== undefined) allowed.status = patch.status;
  if (patch.default_map_center !== undefined)
    allowed.default_map_center = patch.default_map_center;
  if (patch.default_map_zoom !== undefined)
    allowed.default_map_zoom = patch.default_map_zoom;
  if (patch.default_tile_provider !== undefined)
    allowed.default_tile_provider = patch.default_tile_provider;
  if (patch.tracking_zoom_moving !== undefined)
    allowed.tracking_zoom_moving = patch.tracking_zoom_moving;
  if (patch.tracking_zoom_stopped !== undefined)
    allowed.tracking_zoom_stopped = patch.tracking_zoom_stopped;
  if (patch.tracking_stop_radius_m !== undefined)
    allowed.tracking_stop_radius_m = patch.tracking_stop_radius_m;
  if (patch.session_timeout_hours !== undefined)
    allowed.session_timeout_hours = patch.session_timeout_hours;

  if (Object.keys(allowed).length === 0) {
    const err = new Error('No valid fields to update');
    err.status = 400;
    throw err;
  }

  // Code uniqueness check
  if (allowed.code) {
    const dup = await prisma.agency.findFirst({
      where: { code: allowed.code, id: { not: id } },
    });
    if (dup) {
      const err = new Error('Agency code already in use');
      err.status = 409;
      throw err;
    }
  }

  const updated = await prisma.agency.update({
    where: { id },
    data: allowed,
  });

  await refreshAgencyInCache(id);

  return updated;
}

// =====================================================================
// ROTATE TOKEN
// =====================================================================

/**
 * Generate new agency_token. ALL Flutter clients with old token will be
 * rejected until re-provisioned. Use with caution.
 */
export async function rotateAgencyToken(id) {
  const newToken = generateAgencyToken();
  const updated = await prisma.agency.update({
    where: { id },
    data: { agency_token: newToken },
  });
  await refreshAgencyInCache(id);
  return { agency_token: updated.agency_token };
}

// =====================================================================
// DISABLE
// =====================================================================

export async function disableAgency(id) {
  await prisma.agency.update({
    where: { id },
    data: { status: false },
  });
  removeAgencyFromCache(id);
  return { ok: true };
}