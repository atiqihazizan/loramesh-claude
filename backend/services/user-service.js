// services/user-service.js
// Global user management. SUPERADMIN only.

import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { env } from '../config/env.js';
import { ROLES } from '../config/constants.js';

// =====================================================================
// LIST
// =====================================================================

export async function listAllUsers({ search, agencyId, levelCode, page = 1, limit = 50 } = {}) {
  const where = {};
  if (search) {
    where.OR = [
      { username: { contains: search } },
      { name: { contains: search } },
      { email: { contains: search } },
    ];
  }
  if (levelCode) {
    where.level = { code: levelCode };
  }
  if (agencyId) {
    where.user_agencies = { some: { agency_id: agencyId } };
  }

  const skip = (page - 1) * limit;

  const [total, users] = await Promise.all([
    prisma.users.count({ where }),
    prisma.users.findMany({
      where,
      include: {
        level: true,
        user_agencies: {
          include: {
            agency: { select: { id: true, code: true, name: true } },
          },
          take: 1,
        },
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    total,
    page,
    limit,
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      email: u.email,
      phone_number: u.phone_number,
      status: u.status,
      device_type: u.device_type,
      level: { id: u.level.id, code: u.level.code, name: u.level.name },
      agency: u.user_agencies[0]?.agency || null,
      must_change_password: u.must_change_password,
      password_changed_at: u.password_changed_at,
      created_at: u.created_at,
    })),
  };
}

// =====================================================================
// GET ONE
// =====================================================================

export async function getUserById(id) {
  const u = await prisma.users.findUnique({
    where: { id },
    include: {
      level: true,
      user_agencies: {
        include: { agency: { select: { id: true, code: true, name: true } } },
      },
    },
  });
  if (!u) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    phone_number: u.phone_number,
    status: u.status,
    device_type: u.device_type,
    level: { id: u.level.id, code: u.level.code, name: u.level.name },
    agencies: u.user_agencies.map((ua) => ua.agency),
    must_change_password: u.must_change_password,
    password_changed_at: u.password_changed_at,
    created_at: u.created_at,
  };
}

// =====================================================================
// CREATE (SUPERADMIN-only — can create any role including SUPERADMIN)
// =====================================================================

export async function createUserGlobal(payload) {
  const { username, password, email, name, phone_number, level_id, agency_id } = payload;

  if (!level_id) {
    const err = new Error('level_id required');
    err.status = 400;
    throw err;
  }

  const level = await prisma.level.findUnique({ where: { id: level_id } });
  if (!level) {
    const err = new Error('Invalid level_id');
    err.status = 400;
    throw err;
  }

  // Non-SUPERADMIN must have agency
  if (level.code !== ROLES.SUPERADMIN && !agency_id) {
    const err = new Error('agency_id required for non-SUPERADMIN users');
    err.status = 400;
    throw err;
  }
  if (agency_id) {
    const agencyExists = await prisma.agency.findUnique({ where: { id: agency_id } });
    if (!agencyExists) {
      const err = new Error('Invalid agency_id');
      err.status = 400;
      throw err;
    }
  }

  const existing = await prisma.users.findUnique({ where: { username } });
  if (existing) {
    const err = new Error('Username already exists');
    err.status = 409;
    throw err;
  }

  const hash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

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
      },
    });
    if (agency_id) {
      await tx.user_agency.create({
        data: { user_id: created.id, agency_id },
      });
    }
    return created;
  });

  return { id: user.id, username: user.username };
}

// =====================================================================
// UPDATE
// =====================================================================

export async function updateUserGlobal(id, patch) {
  const allowed = {};
  if (patch.name !== undefined) allowed.name = patch.name;
  if (patch.email !== undefined) allowed.email = patch.email;
  if (patch.phone_number !== undefined) allowed.phone_number = patch.phone_number;
  if (patch.status !== undefined) allowed.status = patch.status;
  if (patch.level_id !== undefined) {
    const lvl = await prisma.level.findUnique({ where: { id: patch.level_id } });
    if (!lvl) {
      const err = new Error('Invalid level_id');
      err.status = 400;
      throw err;
    }
    allowed.level_id = lvl.id;
  }

  if (Object.keys(allowed).length === 0) {
    const err = new Error('No valid fields to update');
    err.status = 400;
    throw err;
  }

  await prisma.users.update({ where: { id }, data: allowed });
  return getUserById(id);
}

// =====================================================================
// MOVE TO AGENCY
// =====================================================================

/**
 * Reassign user to a new agency. Current design: one agency per user.
 * Removes existing assignments, creates new one.
 */
export async function moveUserToAgency(userId, agencyId) {
  const user = await prisma.users.findUnique({ where: { id: userId } });
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  const agency = await prisma.agency.findUnique({ where: { id: agencyId } });
  if (!agency) {
    const err = new Error('Agency not found');
    err.status = 404;
    throw err;
  }

  await prisma.$transaction(async (tx) => {
    await tx.user_agency.deleteMany({ where: { user_id: userId } });
    await tx.user_agency.create({
      data: { user_id: userId, agency_id: agencyId },
    });
  });

  return { ok: true, agency: { id: agency.id, code: agency.code, name: agency.name } };
}

// =====================================================================
// DISABLE
// =====================================================================

export async function disableUserGlobal(id) {
  await prisma.users.update({
    where: { id },
    data: { status: 'disabled' },
  });
  return { ok: true };
}

// =====================================================================
// LEVELS (read-only — for dropdowns)
// =====================================================================

export async function listLevels() {
  return prisma.level.findMany({
    orderBy: { rank: 'desc' },
    select: { id: true, code: true, name: true, rank: true },
  });
}