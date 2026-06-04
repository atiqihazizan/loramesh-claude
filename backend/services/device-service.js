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
export async function listDevices({ user, agencyIdFilter, search, approval = 'approved' }) {
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
  if (approval === 'approved') {
    where.need_approval = false;
  } else if (approval === 'pending') {
    where.need_approval = true;
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

  // Ambil status_live dari live_tracking (relasi String FK — query berasingan).
  const deviceIds = devices.map((d) => d.device_id);
  const liveRows = await prisma.live_tracking.findMany({
    where: { device_id: { in: deviceIds } },
    select: { device_id: true, status_live: true },
  });
  const liveMap = new Map(liveRows.map((r) => [r.device_id, r.status_live]));

  return devices.map((d) => ({
    id: d.id,
    device_id: d.device_id,
    device_mac: d.device_mac,
    name: d.name,
    type: d.device_type,
    status: liveMap.get(d.device_id) ?? 'offline', // status_live untuk marker map
    is_static: d.is_static,
    logging_enabled: d.logging_enabled,
    latitude: d.latitude,
    longitude: d.longitude,
    last_seen_at: d.last_seen_at,
    need_approval: d.need_approval,
    date_approved: d.date_approved,
    agencies: d.device_agencies.map((da) => da.agency),
    active: d.device_agencies.length > 0, // aktif = ada keahlian agensi aktif
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
    status: d.status,
    is_static: d.is_static,
    logging_enabled: d.logging_enabled,
    latitude: d.latitude,
    longitude: d.longitude,
    last_seen_at: d.last_seen_at,
    need_approval: d.need_approval,
    date_approved: d.date_approved,
    agencies: d.device_agencies.map((da) => da.agency),
    active: d.device_agencies.length > 0,
    created_at: d.created_at,
    updated_at: d.updated_at,
  };
}

/**
 * Approve a self-registered (pending) device.
 * ADMIN_AGENCY → only devices in their agency. SUPERADMIN → any.
 * Idempotent: approving an already-approved device is a no-op.
 */
export async function approveDevice(id, user) {
  const d = await prisma.devices.findUnique({
    where: { id },
    include: {
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

  if (user.level.code !== ROLES.SUPERADMIN) {
    const inAgency = d.device_agencies.some((da) => da.agency.id === user.agency?.id);
    if (!inAgency) {
      const err = new Error('Forbidden — device not in your agency');
      err.status = 403;
      throw err;
    }
  }

  if (!d.need_approval) {
    return { id: d.id, device_id: d.device_id, need_approval: false, date_approved: d.date_approved };
  }

  const updated = await prisma.devices.update({
    where: { id },
    data: { need_approval: false, date_approved: new Date() },
  });

  return {
    id: updated.id,
    device_id: updated.device_id,
    need_approval: updated.need_approval,
    date_approved: updated.date_approved,
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
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        is_static: is_static ?? false,
        logging_enabled: logging_enabled ?? true,
        need_approval: false,
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

/**
 * SUPERADMIN only — move device to another agency without re-approval.
 */
async function transferDeviceAgencySuperadmin(devicePkId, targetAgencyIdRaw, deviceRow) {
  const targetAgencyId = parseInt(targetAgencyIdRaw, 10);
  if (!targetAgencyId) {
    const err = new Error('Invalid agency_id');
    err.status = 400;
    throw err;
  }

  const agencyRow = await prisma.agency.findUnique({
    where: { id: targetAgencyId },
    select: { id: true, status: true },
  });
  if (!agencyRow?.status) {
    const err = new Error('Agency not found or inactive');
    err.status = 400;
    throw err;
  }

  const currentAgencyId = deviceRow.agencies[0]?.id ?? null;
  if (currentAgencyId === targetAgencyId) {
    return;
  }

  let oldAgencyId = null;
  const deviceIdStr = deviceRow.device_id;

  await prisma.$transaction(async (tx) => {
    const existingLink = await tx.device_agency.findUnique({
      where: {
        device_id_agency_id: {
          device_id: devicePkId,
          agency_id: targetAgencyId,
        },
      },
    });

    const otherActive = await tx.device_agency.findMany({
      where: {
        device_id: devicePkId,
        active: true,
        agency_id: { not: targetAgencyId },
      },
    });

    oldAgencyId = otherActive.length > 0 ? otherActive[0].agency_id : null;
    if (otherActive.length > 0) {
      await tx.device_agency.updateMany({
        where: {
          device_id: devicePkId,
          active: true,
          agency_id: { not: targetAgencyId },
        },
        data: { active: false, deactivated_at: new Date() },
      });
    }

    if (existingLink) {
      await tx.device_agency.update({
        where: { id: existingLink.id },
        data: { active: true, deactivated_at: null },
      });
    } else {
      await tx.device_agency.create({
        data: {
          device_id: devicePkId,
          agency_id: targetAgencyId,
          name: deviceRow.name,
          active: true,
        },
      });
    }

    await tx.devices.update({
      where: { id: devicePkId },
      data: { need_approval: false, date_approved: new Date() },
    });

    await tx.device_log.create({
      data: {
        device_id: devicePkId,
        change_type: 'transfer',
        old_agency_id: oldAgencyId,
        new_agency_id: targetAgencyId,
        change_reason: 'Agency reassigned by superadmin (settings)',
      },
    });
  });

  if (oldAgencyId != null) {
    unassignDeviceFromAgencyInCache(deviceIdStr, oldAgencyId);
  }
  assignDeviceToAgencyInCache(deviceIdStr, targetAgencyId);
}

export async function updateDevice(id, patch, user) {
  const deviceRow = await getDeviceById(id, user);

  let agencyTransferred = false;
  if (patch.agency_id !== undefined) {
    if (user.level.code !== ROLES.SUPERADMIN) {
      const err = new Error('Only superadmin may change device agency');
      err.status = 403;
      throw err;
    }
    await transferDeviceAgencySuperadmin(id, patch.agency_id, deviceRow);
    agencyTransferred = true;
  }

  const allowed = {};
  if (patch.name !== undefined) allowed.name = patch.name;
  if (patch.device_mac !== undefined) allowed.device_mac = patch.device_mac;
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

  if (Object.keys(allowed).length === 0 && !agencyTransferred) {
    const err = new Error('No valid fields to update');
    err.status = 400;
    throw err;
  }

  if (Object.keys(allowed).length > 0) {
    await prisma.devices.update({ where: { id }, data: allowed });
  }
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