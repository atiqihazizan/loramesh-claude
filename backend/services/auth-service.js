// services/auth-service.js
// Business logic for authentication: login, password change/reset, JWT issue.

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { env } from '../config/env.js';

// =====================================================================
// JWT
// =====================================================================

/**
 * Compute expiresIn string for jwt.sign().
 * If user's agency has custom session_timeout_hours, use that; else env default.
 */
function expiresInForAgency(agency) {
  if (agency?.session_timeout_hours && agency.session_timeout_hours > 0) {
    return `${agency.session_timeout_hours}h`;
  }
  return env.JWT_EXPIRES_IN;
}

function signToken(user, expiresIn) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      level: user.level?.code,
      agency_id: user.user_agencies?.[0]?.agency_id || null,
    },
    env.JWT_SECRET,
    { expiresIn }
  );
}

// =====================================================================
// LOGIN
// =====================================================================

/**
 * Login with username/password.
 *
 * @returns {{token, user, expiresIn}}
 * @throws {Error} with .code and .status
 */
export async function loginWithCredentials({ username, password, deviceType, ipAddress }) {
  // Find user
  const user = await prisma.users.findUnique({
    where: { username },
    include: {
      level: true,
      user_agencies: {
        include: {
          agency: {
            select: {
              id: true,
              code: true,
              name: true,
              status: true,
              session_timeout_hours: true,
            },
          },
        },
      },
    },
  });

  // Log every attempt (success or fail)
  const logAttempt = async (status) => {
    try {
      await prisma.login_logs.create({
        data: {
          user_id: user?.id ?? null,
          username,
          status,
          ip_address: ipAddress?.slice(0, 45) ?? null,
          device_type: deviceType ?? null,
        },
      });
    } catch (e) {
      console.warn('[auth] Failed to log login attempt:', e.message);
    }
  };

  if (!user) {
    await logAttempt('failed');
    const err = new Error('Invalid username or password');
    err.code = 'INVALID_CREDENTIALS';
    err.status = 401;
    throw err;
  }

  if (user.status === 'banned' || user.status === 'disabled') {
    await logAttempt('failed');
    const err = new Error('Account is disabled');
    err.code = 'ACCOUNT_DISABLED';
    err.status = 403;
    throw err;
  }

  const passwordOk = await bcrypt.compare(password, user.password);
  if (!passwordOk) {
    await logAttempt('failed');
    const err = new Error('Invalid username or password');
    err.code = 'INVALID_CREDENTIALS';
    err.status = 401;
    throw err;
  }

  // Check agency is active (unless SUPERADMIN — they can log in without agency)
  const agencyLink = user.user_agencies[0];
  if (user.level.code !== 'SUPERADMIN') {
    if (!agencyLink) {
      await logAttempt('failed');
      const err = new Error('No agency assigned to your account');
      err.code = 'NO_AGENCY';
      err.status = 403;
      throw err;
    }
    if (!agencyLink.agency.status) {
      await logAttempt('failed');
      const err = new Error('Your agency is inactive');
      err.code = 'AGENCY_INACTIVE';
      err.status = 403;
      throw err;
    }
  }

  // Mark online + record device type
  await prisma.users.update({
    where: { id: user.id },
    data: {
      status: 'online',
      device_type: deviceType || 'Web',
    },
  });

  await logAttempt('success');

  // Issue token
  const expiresIn = expiresInForAgency(agencyLink?.agency);
  const token = signToken(user, expiresIn);

  return {
    token,
    expiresIn,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      level: {
        id: user.level.id,
        code: user.level.code,
        name: user.level.name,
        rank: user.level.rank,
      },
      agency: agencyLink?.agency
        ? {
            id: agencyLink.agency.id,
            code: agencyLink.agency.code,
            name: agencyLink.agency.name,
          }
        : null,
      must_change_password: user.must_change_password === true,
    },
  };
}

// =====================================================================
// LOGOUT
// =====================================================================

/**
 * Mark user offline. Token invalidation is client-side (delete from storage)
 * because we don't maintain a server-side session store.
 */
export async function logoutUser(userId) {
  if (!userId) return;
  await prisma.users.update({
    where: { id: userId },
    data: { status: 'offline' },
  });
}

// =====================================================================
// ME
// =====================================================================

/**
 * Fetch current user details. Used by GET /api/auth/me.
 */
export async function getCurrentUser(userId) {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    include: {
      level: true,
      user_agencies: {
        include: {
          agency: {
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
            },
          },
        },
      },
    },
  });

  if (!user) return null;

  const agencyLink = user.user_agencies[0];
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    phone_number: user.phone_number,
    device_type: user.device_type,
    status: user.status,
    level: {
      id: user.level.id,
      code: user.level.code,
      name: user.level.name,
      rank: user.level.rank,
    },
    agency: agencyLink?.agency || null,
    must_change_password: user.must_change_password === true,
    password_changed_at: user.password_changed_at,
    created_at: user.created_at,
  };
}

// =====================================================================
// PASSWORD CHANGE (self-service)
// =====================================================================

/**
 * User changes their own password. Requires current password.
 */
export async function changeOwnPassword(userId, currentPassword, newPassword) {
  if (currentPassword === newPassword) {
    const err = new Error('New password must differ from current');
    err.code = 'PASSWORD_UNCHANGED';
    err.status = 400;
    throw err;
  }

  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { id: true, password: true },
  });
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const currentOk = await bcrypt.compare(currentPassword, user.password);
  if (!currentOk) {
    const err = new Error('Current password is incorrect');
    err.code = 'CURRENT_PASSWORD_WRONG';
    err.status = 400;
    throw err;
  }

  const hash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  await prisma.users.update({
    where: { id: userId },
    data: {
      password: hash,
      password_changed_at: new Date(),
      must_change_password: false,
    },
  });

  return { ok: true };
}

// =====================================================================
// PASSWORD RESET (admin acting on another user)
// =====================================================================

/**
 * Admin resets another user's password. No current password needed.
 * If forceChange = true, sets must_change_password = true so user must
 * pick a new one on next login.
 *
 * Caller (route handler) must verify admin has authority over target user.
 */
export async function resetUserPassword(targetUserId, newPassword, forceChange = true) {
  const user = await prisma.users.findUnique({
    where: { id: targetUserId },
    select: { id: true },
  });
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const hash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  await prisma.users.update({
    where: { id: targetUserId },
    data: {
      password: hash,
      password_changed_at: new Date(),
      must_change_password: !!forceChange,
    },
  });

  return { ok: true, must_change_password: !!forceChange };
}

// =====================================================================
// SESSION CONFIG (public — for login UX hint)
// =====================================================================

/**
 * Return JWT TTL for a given agency code. Used by frontend BEFORE login
 * to show "Session lasts X days" or similar.
 *
 * Returns null if agency not found (frontend falls back to global default).
 */
export async function getSessionConfigForAgency(agencyCode) {
  if (!agencyCode) {
    return { session_timeout_hours: parseDurationToHours(env.JWT_EXPIRES_IN) };
  }
  const agency = await prisma.agency.findUnique({
    where: { code: agencyCode },
    select: { session_timeout_hours: true, status: true },
  });
  if (!agency || !agency.status) return null;
  return {
    session_timeout_hours:
      agency.session_timeout_hours || parseDurationToHours(env.JWT_EXPIRES_IN),
  };
}

/** Convert "7d" / "24h" / "30m" to hours (rough). */
function parseDurationToHours(s) {
  if (!s) return 168;
  const m = String(s).match(/^(\d+)([dhm])$/);
  if (!m) return 168;
  const n = parseInt(m[1], 10);
  switch (m[2]) {
    case 'd': return n * 24;
    case 'h': return n;
    case 'm': return Math.max(1, Math.floor(n / 60));
    default:  return 168;
  }
}