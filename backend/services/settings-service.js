// services/settings-service.js
// Business logic for ADMIN_AGENCY settings management.

import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { env } from '../config/env.js';
import { ROLES, isRoleAtLeast } from '../config/constants.js';
import { refreshAgencyInCache } from '../lib/cache/agency-cache.js';
import { resetUserPassword } from './auth-service.js';

// =====================================================================
// AGENCY SETTINGS
// =====================================================================

/**
 * Get all settings for an agency (map, tracking, session).
 */
export async function getAgencySettings(agencyId) {
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: {
      id: true,
      code: true,
      name: true,
      default_map_center: true,
      default_map_zoom: true,
      default_tile_provider: true,
      tracking_zoom_moving: true,
      tracking_zoom_stopped: true,
      tracking_stop_radius_m: true,
      session_timeout_hours: true,
      created_at: true,
      updated_at: true,
    },
  });
  if (!agency) {
    const err = new Error('Agency not found');
    err.status = 404;
    throw err;
  }
  return agency;
}

/**
 * Update agency settings. Whitelist of allowed fields (caller can't sneak
 * in code/name/agency_token changes — those are SUPERADMIN-only via /api/agencies).
 */
export async function updateAgencySettings(agencyId, patch) {
  const allowed = {};
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

  // Sanity: moving zoom should typically be >= stopped zoom (closer when moving).
  // We don't enforce hard — admin may want otherwise. Just log warning.
  if (
    allowed.tracking_zoom_moving !== undefined &&
    allowed.tracking_zoom_stopped !== undefined &&
    allowed.tracking_zoom_moving < allowed.tracking_zoom_stopped
  ) {
    console.warn(
      `[settings] Agency ${agencyId}: tracking_zoom_moving (${allowed.tracking_zoom_moving}) < tracking_zoom_stopped (${allowed.tracking_zoom_stopped}) — unusual but allowed`
    );
  }

  const updated = await prisma.agency.update({
    where: { id: agencyId },
    data: allowed,
    select: {
      id: true,
      code: true,
      name: true,
      default_map_center: true,
      default_map_zoom: true,
      default_tile_provider: true,
      tracking_zoom_moving: true,
      tracking_zoom_stopped: true,
      tracking_stop_radius_m: true,
      session_timeout_hours: true,
      updated_at: true,
    },
  });

  // Cache only stores tokens — settings change doesn't affect cache.
  // But agency token might be cached — refresh for safety.
  await refreshAgencyInCache(agencyId);

  return updated;
}

// =====================================================================
// USERS IN AGENCY
// =====================================================================

/**
 * List users belonging to an agency. Excludes SUPERADMIN (they don't belong
 * to one specific agency).
 */
export async function listAgencyUsers(agencyId) {
  const userAgencies = await prisma.user_agency.findMany({
    where: { agency_id: agencyId },
    include: {
      user: {
        include: { level: true },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  return userAgencies.map((ua) => ({
    id: ua.user.id,
    username: ua.user.username,
    name: ua.user.name,
    email: ua.user.email,
    phone_number: ua.user.phone_number,
    status: ua.user.status,
    level: {
      id: ua.user.level.id,
      code: ua.user.level.code,
      name: ua.user.level.name,
    },
    must_change_password: ua.user.must_change_password === true,
    password_changed_at: ua.user.password_changed_at,
    created_at: ua.user.created_at,
  }));
}

/**
 * Create new user in an agency.
 * Caller must be ADMIN_AGENCY in that agency, or SUPERADMIN.
 *
 * Level allowed: ADMIN_AGENCY, USER_AGENCY, VIEWER (NOT SUPERADMIN —
 * only an existing SUPERADMIN can create another SUPERADMIN via /api/agencies).
 */
export async function createAgencyUser(agencyId, payload, actorRole) {
  const { username, password, email, name, phone_number, level_id } = payload;

  // Resolve level — default USER_AGENCY if not specified
  let level;
  if (level_id) {
    level = await prisma.level.findUnique({ where: { id: level_id } });
    if (!level) {
      const err = new Error('Invalid level_id');
      err.status = 400;
      throw err;
    }
  } else {
    level = await prisma.level.findUnique({ where: { code: ROLES.USER_AGENCY } });
  }

  // Permission: cannot create user with role higher than actor
  if (!isRoleAtLeast(actorRole, level.code)) {
    const err = new Error(`Cannot create user with role ${level.code} (higher than yours)`);
    err.status = 403;
    throw err;
  }

  // Block creating SUPERADMIN via this endpoint
  if (level.code === ROLES.SUPERADMIN) {
    const err = new Error('SUPERADMIN must be created via /api/agencies endpoint');
    err.status = 403;
    throw err;
  }

  // Check username uniqueness (case-insensitive caution: MySQL default collation
  // is usually case-insensitive but depends on column)
  const existing = await prisma.users.findUnique({ where: { username } });
  if (existing) {
    const err = new Error('Username already exists');
    err.status = 409;
    throw err;
  }

  const hash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

  // Create user + link to agency in transaction
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.users.create({
      data: {
        username,
        password: hash,
        email: email || null,
        name: name || null,
        phone_number: phone_number || null,
        level_id: level.id,
        status: 'offline',
        password_changed_at: new Date(),
        must_change_password: false,
      },
    });
    await tx.user_agency.create({
      data: {
        user_id: created.id,
        agency_id: agencyId,
      },
    });
    return created;
  });

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    phone_number: user.phone_number,
    status: user.status,
    level: { id: level.id, code: level.code, name: level.name },
    created_at: user.created_at,
  };
}

/**
 * Update user fields. Cannot change agency or change role to something higher
 * than actor.
 */
export async function updateAgencyUser(agencyId, userId, patch, actor) {
  // Verify target user is in this agency
  const link = await prisma.user_agency.findUnique({
    where: {
      user_id_agency_id: { user_id: userId, agency_id: agencyId },
    },
    include: { user: { include: { level: true } } },
  });
  if (!link) {
    const err = new Error('User not in this agency');
    err.status = 404;
    throw err;
  }

  // Self-edit guard: cannot demote yourself or change own role
  if (userId === actor.id && patch.level_id !== undefined && patch.level_id !== link.user.level_id) {
    const err = new Error('Cannot change your own role');
    err.status = 403;
    throw err;
  }

  const allowed = {};
  if (patch.name !== undefined) allowed.name = patch.name;
  if (patch.email !== undefined) allowed.email = patch.email;
  if (patch.phone_number !== undefined) allowed.phone_number = patch.phone_number;
  if (patch.status !== undefined) allowed.status = patch.status;

  if (patch.level_id !== undefined) {
    const newLevel = await prisma.level.findUnique({ where: { id: patch.level_id } });
    if (!newLevel) {
      const err = new Error('Invalid level_id');
      err.status = 400;
      throw err;
    }
    // Can only assign role <= actor's role
    if (!isRoleAtLeast(actor.level.code, newLevel.code)) {
      const err = new Error(`Cannot assign role ${newLevel.code} (higher than yours)`);
      err.status = 403;
      throw err;
    }
    if (newLevel.code === ROLES.SUPERADMIN) {
      const err = new Error('Cannot assign SUPERADMIN role here');
      err.status = 403;
      throw err;
    }
    allowed.level_id = newLevel.id;
  }

  if (Object.keys(allowed).length === 0) {
    const err = new Error('No valid fields to update');
    err.status = 400;
    throw err;
  }

  const updated = await prisma.users.update({
    where: { id: userId },
    data: allowed,
    include: { level: true },
  });

  return {
    id: updated.id,
    username: updated.username,
    name: updated.name,
    email: updated.email,
    phone_number: updated.phone_number,
    status: updated.status,
    level: { id: updated.level.id, code: updated.level.code, name: updated.level.name },
  };
}

/**
 * Disable user (soft delete) — set status='disabled'. Keeps record for audit.
 */
export async function disableAgencyUser(agencyId, userId, actor) {
  if (userId === actor.id) {
    const err = new Error('Cannot disable yourself');
    err.status = 403;
    throw err;
  }

  const link = await prisma.user_agency.findUnique({
    where: {
      user_id_agency_id: { user_id: userId, agency_id: agencyId },
    },
    include: { user: { include: { level: true } } },
  });
  if (!link) {
    const err = new Error('User not in this agency');
    err.status = 404;
    throw err;
  }

  // Cannot disable user with role higher than yours
  if (!isRoleAtLeast(actor.level.code, link.user.level.code)) {
    const err = new Error('Cannot disable user with role higher than yours');
    err.status = 403;
    throw err;
  }

  await prisma.users.update({
    where: { id: userId },
    data: { status: 'disabled' },
  });

  return { ok: true, message: 'User disabled' };
}

/**
 * Admin resets target user's password. Always forces change on next login.
 */
export async function resetAgencyUserPassword(agencyId, userId, newPassword, actor) {
  if (userId === actor.id) {
    const err = new Error('Use /api/auth/password to change your own password');
    err.status = 403;
    throw err;
  }

  // Verify target is in this agency
  const link = await prisma.user_agency.findUnique({
    where: {
      user_id_agency_id: { user_id: userId, agency_id: agencyId },
    },
    include: { user: { include: { level: true } } },
  });
  if (!link) {
    const err = new Error('User not in this agency');
    err.status = 404;
    throw err;
  }

  // Cannot reset password of user with role higher than yours
  if (!isRoleAtLeast(actor.level.code, link.user.level.code)) {
    const err = new Error('Cannot reset password of user with role higher than yours');
    err.status = 403;
    throw err;
  }

  await resetUserPassword(userId, newPassword, true);
  return { ok: true, must_change_password: true };
}

// =====================================================================
// USER UI PREFERENCES (theme, etc.)
// =====================================================================

/**
 * Get own UI preferences. Currently only theme_preference; expandable later.
 */
export async function getMyPreferences(userId) {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { theme_preference: true },
  });
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return {
    theme_preference: user.theme_preference || 'light',
  };
}

/**
 * Update own UI preferences.
 */
export async function updateMyPreferences(userId, patch) {
  const allowed = {};
  if (patch.theme_preference !== undefined) {
    const valid = ['light', 'dark', 'auto'];
    if (!valid.includes(patch.theme_preference)) {
      const err = new Error(`theme_preference must be one of: ${valid.join(', ')}`);
      err.status = 400;
      throw err;
    }
    allowed.theme_preference = patch.theme_preference;
  }

  if (Object.keys(allowed).length === 0) {
    const err = new Error('No valid fields to update');
    err.status = 400;
    throw err;
  }

  const updated = await prisma.users.update({
    where: { id: userId },
    data: allowed,
    select: { theme_preference: true },
  });
  return updated;
}