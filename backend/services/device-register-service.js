// Self-registration for APK (QR agency token) — check status + register device.

import prisma from '../lib/prisma.js';
import {
  assignDeviceToAgencyInCache,
  loadDeviceAgencyCache,
  unassignDeviceFromAgencyInCache,
} from '../lib/cache/device-agency-cache.js';
import { notifyDevicePending } from './notification-service.js';

function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function mapLastKnown(live) {
  if (!live) return null;
  return {
    latitude: live.latitude,
    longitude: live.longitude,
    speed: live.speed,
    heading: live.heading,
    status_live: live.status_live,
    sensor_data: live.sensor_data,
    updated_at: live.updated_at,
  };
}

function pickActiveAgency(deviceAgencies) {
  const link = deviceAgencies?.find((da) => da.active && da.agency);
  if (!link?.agency) return null;
  return {
    id: link.agency.id,
    code: link.agency.code,
    name: link.agency.name,
  };
}

/**
 * PUBLIC — APK check after reinstall.
 */
export async function checkDevice(deviceId) {
  const device = await prisma.devices.findUnique({
    where: { device_id: deviceId },
    include: {
      device_agencies: {
        where: { active: true },
        include: {
          agency: { select: { id: true, code: true, name: true } },
        },
      },
    },
  });

  if (!device) {
    return { exists: false, device: null };
  }

  const live = await prisma.live_tracking.findUnique({
    where: { device_id: deviceId },
  });

  return {
    exists: true,
    device: {
      device_id: device.device_id,
      name: device.name,
      need_approval: device.need_approval,
      date_approved: device.date_approved,
      agency: pickActiveAgency(device.device_agencies),
      last_known: mapLastKnown(live),
    },
  };
}

/**
 * POST /register — agency from req.agency (token); body agencyId ignored if mismatched.
 */
export async function registerDevice({ deviceId, name, agencyId: _bodyAgencyId }, agency) {
  const targetAgencyId = agency.id;
  const trimmedName = String(name ?? '').trim();
  if (!deviceId || !trimmedName) {
    throw httpError('device_id and name are required', 400);
  }

  const agencyRow = await prisma.agency.findUnique({
    where: { id: targetAgencyId },
    select: {
      id: true,
      code: true,
      name: true,
      agency_token: true,
      status: true,
    },
  });
  if (!agencyRow?.status) {
    throw httpError('Agency not found or inactive', 403);
  }

  let is_new = false;
  const tokensToUnassign = [];

  const { deviceRow } = await prisma.$transaction(async (tx) => {
    let deviceRow = await tx.devices.findUnique({ where: { device_id: deviceId } });

    if (!deviceRow) {
      is_new = true;
      deviceRow = await tx.devices.create({
        data: {
          device_id: deviceId,
          name: trimmedName,
          need_approval: true,
          status: 'offline',
        },
      });
      await tx.device_agency.create({
        data: {
          device_id: deviceRow.id,
          agency_id: targetAgencyId,
          active: true,
        },
      });
      await tx.device_log.create({
        data: {
          device_id: deviceRow.id,
          change_type: 'assignment',
          old_agency_id: null,
          new_agency_id: targetAgencyId,
          change_reason: 'Self-registration via QR',
        },
      });
      return { deviceRow };
    }

    is_new = false;
    if (deviceRow.name !== trimmedName) {
      deviceRow = await tx.devices.update({
        where: { id: deviceRow.id },
        data: { name: trimmedName },
      });
    }

    const existingLink = await tx.device_agency.findUnique({
      where: {
        device_id_agency_id: {
          device_id: deviceRow.id,
          agency_id: targetAgencyId,
        },
      },
    });

    const otherActive = await tx.device_agency.findMany({
      where: {
        device_id: deviceRow.id,
        active: true,
        agency_id: { not: targetAgencyId },
      },
      include: {
        agency: { select: { agency_token: true } },
      },
    });

    if (otherActive.length > 0) {
      const oldAgencyId = otherActive[0].agency_id;
      for (const row of otherActive) {
        if (row.agency?.agency_token) {
          tokensToUnassign.push(row.agency.agency_token);
        }
      }
      await tx.device_agency.updateMany({
        where: {
          device_id: deviceRow.id,
          active: true,
          agency_id: { not: targetAgencyId },
        },
        data: { active: false, deactivated_at: new Date() },
      });
      if (existingLink) {
        await tx.device_agency.update({
          where: { id: existingLink.id },
          data: { active: true, deactivated_at: null },
        });
      } else {
        await tx.device_agency.create({
          data: {
            device_id: deviceRow.id,
            agency_id: targetAgencyId,
            active: true,
          },
        });
      }
      await tx.device_log.create({
        data: {
          device_id: deviceRow.id,
          change_type: 'transfer',
          old_agency_id: oldAgencyId,
          new_agency_id: targetAgencyId,
          change_reason: 'Self-registration via QR',
        },
      });
    } else if (existingLink) {
      if (!existingLink.active) {
        await tx.device_agency.update({
          where: { id: existingLink.id },
          data: { active: true, deactivated_at: null },
        });
      }
    } else {
      await tx.device_agency.create({
        data: {
          device_id: deviceRow.id,
          agency_id: targetAgencyId,
          active: true,
        },
      });
      await tx.device_log.create({
        data: {
          device_id: deviceRow.id,
          change_type: 'assignment',
          old_agency_id: null,
          new_agency_id: targetAgencyId,
          change_reason: 'Self-registration via QR',
        },
      });
    }

    return { deviceRow };
  });

  for (const token of tokensToUnassign) {
    unassignDeviceFromAgencyInCache(deviceId, token);
  }
  if (agencyRow.agency_token) {
    assignDeviceToAgencyInCache(deviceId, agencyRow.agency_token);
  } else {
    await loadDeviceAgencyCache();
  }

  if (is_new) {
    try {
      await notifyDevicePending({
        deviceId: deviceRow.device_id,
        deviceName: deviceRow.name,
        agencyId: targetAgencyId,
      });
    } catch (err) {
      console.error('[device-register] notifyDevicePending failed:', err);
    }
  }

  return {
    device: {
      device_id: deviceRow.device_id,
      name: deviceRow.name,
      need_approval: deviceRow.need_approval,
    },
    agency: {
      id: agencyRow.id,
      code: agencyRow.code,
      name: agencyRow.name,
    },
    is_new,
  };
}
