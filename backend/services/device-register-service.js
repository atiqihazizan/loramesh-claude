// Self-registration for APK (QR agency token) — check status + register device.

import prisma from '../lib/prisma.js';
import {
  assignDeviceToAgencyInCache,
  unassignDeviceFromAgencyInCache,
} from '../lib/cache/device-agency-cache.js';
import { updateDeviceInCache } from '../lib/cache/device-cache.js';
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
  if (!deviceAgencies || deviceAgencies.length === 0) return null;
  // Cuba link aktif dulu; kalau tiada, ambil yang terkini (sudah diorder desc).
  const link =
    deviceAgencies.find((da) => da.active && da.agency) ||
    deviceAgencies.find((da) => da.agency);
  if (!link?.agency) return null;
  return {
    id: link.agency.id,
    code: link.agency.code,
    name: link.agency.name,
    agency_token: link.agency.agency_token,
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
        // ambil SEMUA link, bukan hanya aktif — supaya tak hilang code
        include: {
          agency: {
            select: { id: true, code: true, name: true, agency_token: true },
          },
        },
        orderBy: { assigned_at: 'desc' }, // terkini dulu
      },
    },
  });

  if (!device) {
    return { exists: false, device: null };
  }

  const live = await prisma.live_tracking.findUnique({
    where: { device_id: deviceId },
  });

  const activeAgency = pickActiveAgency(device.device_agencies);

  return {
    exists: true,
    device: {
      deviceid: device.device_id,
      name: device.name,
      need_approval: device.need_approval,
      date_approved: device.date_approved,
      agency_id: activeAgency?.id ?? null,
      agency_code: activeAgency?.code ?? null,
      agency_name: activeAgency?.name ?? null,
      agency_token: activeAgency?.agency_token ?? null,
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
  const agencyIdsToUnassign = [];

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
    });

    if (otherActive.length > 0) {
      const oldAgencyId = otherActive[0].agency_id;
      for (const row of otherActive) {
        agencyIdsToUnassign.push(row.agency_id);
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

  for (const aid of agencyIdsToUnassign) {
    unassignDeviceFromAgencyInCache(deviceId, aid);
  }
  assignDeviceToAgencyInCache(deviceId, targetAgencyId);
  updateDeviceInCache(deviceId, { status: 'offline' });

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
    success: true,
    device: {
      deviceid: deviceRow.device_id,
      device_id: deviceRow.device_id,
      name: deviceRow.name,
      need_approval: deviceRow.need_approval,
    },
    agency_id: agencyRow.id,
    agency_name: agencyRow.name,
    agency_token: agency.token,
    is_new,
    need_approval: deviceRow.need_approval,
  };
}

/**
 * PUBLIC (APK) — senarai ringkas agency aktif untuk pemilih tukar agency.
 * Hanya id, code, name. TANPA agency_token (jangan dedah token).
 */
export async function listAgenciesPublic() {
  const agencies = await prisma.agency.findMany({
    where: { status: true },
    select: { id: true, code: true, name: true },
    orderBy: { name: 'asc' },
  });
  return agencies;
}

/**
 * PUBLIC (APK) — switch device ke agency lain TANPA scan QR.
 * Guna device_id + agency_id sahaja. device_id WAJIB sudah wujud.
 * Set semula need_approval = true (kena approval admin agency baru).
 */
export async function switchAgency({ deviceId, agencyId }) {
  const targetAgencyId = parseInt(agencyId, 10);
  if (!deviceId || !targetAgencyId) {
    throw httpError('device_id and agency_id are required', 400);
  }

  const agencyRow = await prisma.agency.findUnique({
    where: { id: targetAgencyId },
    select: { id: true, code: true, name: true, agency_token: true, status: true },
  });
  if (!agencyRow?.status) {
    throw httpError('Agency not found or inactive', 403);
  }

  const deviceRow = await prisma.devices.findUnique({
    where: { device_id: deviceId },
  });
  if (!deviceRow) {
    throw httpError('Device not found — register first', 404);
  }

  let oldAgencyId = null;

  await prisma.$transaction(async (tx) => {
    // Cari link sedia ada untuk agency sasaran (jika pernah ada).
    const existingLink = await tx.device_agency.findUnique({
      where: {
        device_id_agency_id: {
          device_id: deviceRow.id,
          agency_id: targetAgencyId,
        },
      },
    });

    // Nyahaktif semua link aktif ke agency lain.
    const otherActive = await tx.device_agency.findMany({
      where: {
        device_id: deviceRow.id,
        active: true,
        agency_id: { not: targetAgencyId },
      },
    });

    oldAgencyId = otherActive.length > 0 ? otherActive[0].agency_id : null;
    if (otherActive.length > 0) {
      await tx.device_agency.updateMany({
        where: {
          device_id: deviceRow.id,
          active: true,
          agency_id: { not: targetAgencyId },
        },
        data: { active: false, deactivated_at: new Date() },
      });
    }

    // Aktifkan / cipta link ke agency sasaran.
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

    // Set semula perlu approval.
    await tx.devices.update({
      where: { id: deviceRow.id },
      data: { need_approval: true, date_approved: null },
    });

    // Log transfer.
    await tx.device_log.create({
      data: {
        device_id: deviceRow.id,
        change_type: 'transfer',
        old_agency_id: oldAgencyId,
        new_agency_id: targetAgencyId,
        change_reason: 'Agency switch via APK (no QR)',
      },
    });
  });

  // Kemas cache device→agency (guna agency_id — selari device-agency-cache v3).
  if (oldAgencyId != null) {
    unassignDeviceFromAgencyInCache(deviceId, oldAgencyId);
  }
  assignDeviceToAgencyInCache(deviceId, targetAgencyId);

  // Notify admin agency baru (pending).
  try {
    await notifyDevicePending({
      deviceId: deviceRow.device_id,
      deviceName: deviceRow.name,
      agencyId: targetAgencyId,
    });
  } catch (err) {
    console.error('[device-register] notifyDevicePending (switch) failed:', err);
  }

  return {
    success: true,
    device_id: deviceRow.device_id,
    name: deviceRow.name,
    need_approval: true,
    agency_id: agencyRow.id,
    agency_code: agencyRow.code,
    agency_name: agencyRow.name,
    agency_token: agencyRow.agency_token,
  };
}