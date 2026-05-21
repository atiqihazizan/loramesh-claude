// services/device-service.js
// Device CRUD. ADMIN_AGENCY manages devices in their agency; SUPERADMIN all.

import prisma from '../lib/prisma.js';
import { ROLES } from '../config/constants.js';
import {
  loadDeviceCache,
} from '../lib/cache/device-cache.js';
import {
  loadDeviceStaticCache,
} from '../lib/cache/device-static-cache.js';
import {
  assignDeviceToAgencyInCache,
  unassignDeviceFromAgencyInCache,
} from '../lib/cache/device-agency-cache.js';
import { getAgencyFromCache } from '../lib/cache/agency-cache.js';

/**
 * Refresh device-related caches after a mutation.
 * Simple approach for demo: reload device + static caches fully.
 * (Small dataset — fine. For production with many devices, do targeted updates.)
 */
async function refreshDeviceCaches() {
  await Promise.all([loadDeviceCache(), loadDeviceStaticCache()]);
}

// =====================================================================
// LIST
// =====================================================================

/**
 * List devices. ADMIN_AGENCY → only their agency. SUPERADMIN → all (or filter
 * by ?agency_id).
 */
export async function listDevices({ user, agencyIdFilter, search }) {
  const isSuper = user.level.code === ROLES.SUPERADMIN;

  // Resolve which agency scope
  let agencyId = null;
  if (isSuper) {
    agencyId = agencyIdFilter || null; // null = all agencies
  } else {
    agencyId = user.agency?.id;
    if (!agencyId) {
      const err = new Error('No agency assigned');
      err.status = 403;
      throw err;
    }
  }

  const where = {};
  if (search) {
    where.OR = [
      { device_id: { contains: search } },
      { name: { contains: search } },
      { device_mac: { contains: search } },
    ];
  }
  if (agencyId) {
    where.device_agencies = { some: { agency_id: agencyId, active: true } };
  }

  const devices = await prisma.devices.findMany({
    where,
    include: {
      device_type: { select: { id: true, name: true, code: true, icon: true, color_code: true } },
      device_agencies: {
        where: { active: true },
        include: { agency: { select: { id: true, code: true, name: true } } },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  return devices.map((d) => ({
    id: d.id,
    device_id: d.device_id,
    device_mac: d.device_mac,
    name: d.name,
    type: d.device_type,
    data_type: d.data_type,
    status: d.status,
    is_static: d.is_static,
    logging_enabled: d.logging_enabled,
    latitude: d.latitude,
    longitude: d.longitude,
    last_seen_at: d.last_seen_at,
    agencies: d.device_agencies.map((da) => da.agency),
    created_at: d.created_at,
  }));
}

// =====================================================================
// GET ONE
// =====================================================================

export async function getDeviceById(id, user) {
  const d = await prisma.devices.findUnique({
    where: { id },
    include: {
      device_type: true,
      device_agencies: {
        where: { active: true },
        include: { agency: { select: { id: true, code: true, name: true } } },
      },
    },
  });
  if (!d) {
    const err = new Error('Device not found');
    err.status = 404;
    throw err;
  }

  // Access check — non-SA must own this device
  if (user.level.code !== ROLES.SUPERADMIN) {
    const inAgency = d.device_agencies.some((da) => da.agency.id === user.agency?.id);
    if (!inAgency) {
      const err = new Error('Forbidden — device not in your agency');
      err.status = 403;
      throw err;
    }
  }

  return {
    id: d.id,
    device_id: d.device_id,
    device_mac: d.device_mac,
    name: d.name,
    type: d.device_type,
    data_type: d.data_type,
    status: d.status,
    is_static: d.is_static,
    logging_enabled: d.logging_enabled,
    latitude: d.latitude,
    longitude: d.longitude,
    last_seen_at: d.last_seen_at,
    agencies: d.device_agencies.map((da) => da.agency),
    created_at: d.created_at,
    updated_at: d.updated_at,
  };
}

// =====================================================================
// CREATE
// =====================================================================

/**
 * Create device + link to an agency.
 * ADMIN_AGENCY → device auto-linked to their agency.
 * SUPERADMIN → must pass agency_id (or device created unassigned).
 */
export async function createDevice(payload, user) {
  const {
    device_id,
    name,
    device_mac,
    type_id,
    data_type,
    latitude,
    longitude,
    is_static,
    logging_enabled,
  } = payload;

  // Resolve target agency
  let agencyId;
  if (user.level.code === ROLES.SUPERADMIN) {
    agencyId = payload.agency_id || user.agency?.id || null;
  } else {
    agencyId = user.agency?.id;
    if (!agencyId) {
      const err = new Error('No agency assigned');
      err.status = 403;
      throw err;
    }
  }

  // Uniqueness check
  const existing = await prisma.devices.findUnique({ where: { device_id } });
  if (existing) {
    const err = new Error('device_id already exists');
    err.status = 409;
    throw err;
  }

  // Validate type_id if given
  if (type_id) {
    const t = await prisma.device_type.findUnique({ where: { id: type_id } });
    if (!t) {
      const err = new Error('Invalid type_id');
      err.status = 400;
      throw err;
    }
  }

  const device = await prisma.$transaction(async (tx) => {
    const created = await tx.devices.create({
      data: {
        device_id,
        name,
        device_mac: device_mac || null,
        type_id: type_id || null,
        data_type: data_type || null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        is_static: is_static ?? false,
        logging_enabled: logging_enabled ?? true,
        status: 'offline',
      },
    });
    if (agencyId) {
      await tx.device_agency.create({
        data: {
          device_id: created.id,
          agency_id: agencyId,
          name: name,
          active: true,
        },
      });
    }
    return created;
  });

  // Update caches
  await refreshDeviceCaches();
  if (agencyId) {
    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
      select: { agency_token: true },
    });
    if (agency) assignDeviceToAgencyInCache(device.device_id, agency.agency_token);
  }

  return getDeviceById(device.id, user);
}

// =====================================================================
// UPDATE
// =====================================================================

export async function updateDevice(id, patch, user) {
  // Load + access check via getDeviceById (throws if forbidden)
  await getDeviceById(id, user);

  const allowed = {};
  if (patch.name !== undefined) allowed.name = patch.name;
  if (patch.device_mac !== undefined) allowed.device_mac = patch.device_mac;
  if (patch.data_type !== undefined) allowed.data_type = patch.data_type;
  if (patch.latitude !== undefined) allowed.latitude = patch.latitude;
  if (patch.longitude !== undefined) allowed.longitude = patch.longitude;
  if (patch.is_static !== undefined) allowed.is_static = patch.is_static;
  if (patch.logging_enabled !== undefined) allowed.logging_enabled = patch.logging_enabled;
  if (patch.status !== undefined) allowed.status = patch.status;
  if (patch.type_id !== undefined) {
    if (patch.type_id === null) {
      allowed.type_id = null;
    } else {
      const t = await prisma.device_type.findUnique({ where: { id: patch.type_id } });
      if (!t) {
        const err = new Error('Invalid type_id');
        err.status = 400;
        throw err;
      }
      allowed.type_id = patch.type_id;
    }
  }

  if (Object.keys(allowed).length === 0) {
    const err = new Error('No valid fields to update');
    err.status = 400;
    throw err;
  }

  await prisma.devices.update({ where: { id }, data: allowed });
  await refreshDeviceCaches();

  return getDeviceById(id, user);
}

// =====================================================================
// DELETE (remove from agency — soft; deactivate device_agency link)
// =====================================================================

/**
 * Demo: "delete" = deactivate the device_agency link for the user's agency.
 * The devices row itself is kept (other agencies may still use it, plus
 * playback table preservation).
 * SUPERADMIN with ?hard=true could fully delete — see comment below.
 */
export async function removeDevice(id, user) {
  const device = await getDeviceById(id, user); // access check

  const agencyId =
    user.level.code === ROLES.SUPERADMIN
      ? device.agencies[0]?.id // SA: just take first (demo simplification)
      : user.agency?.id;

  if (!agencyId) {
    const err = new Error('Cannot resolve agency for this device');
    err.status = 400;
    throw err;
  }

  await prisma.device_agency.updateMany({
    where: { device_id: id, agency_id: agencyId },
    data: { active: false, deactivated_at: new Date() },
  });

  // Update cache
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { agency_token: true },
  });
  if (agency) unassignDeviceFromAgencyInCache(device.device_id, agency.agency_token);

  await refreshDeviceCaches();

  // TODO production: add hard-delete option for SUPERADMIN that also
  // drops the playback table via lib/playback.js dropPlaybackTable().

  return { ok: true, message: 'Device removed from agency' };
}