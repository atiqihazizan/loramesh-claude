// services/master-data-service.js
// device_type + master_sensor CRUD. SUPERADMIN only.

import prisma from '../lib/prisma.js';

// =====================================================================
// DEVICE TYPES
// =====================================================================

export async function listDeviceTypes() {
  return prisma.device_type.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { devices: true } },
    },
  }).then((rows) =>
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      icon: r.icon,
      color_code: r.color_code,
      device_count: r._count.devices,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }))
  );
}

export async function createDeviceType(payload) {
  const { name, code, icon, color_code } = payload;
  return prisma.device_type.create({
    data: {
      name: name || null,
      code: code || null,
      icon: icon || null,
      color_code: color_code || '#808080',
    },
  });
}

export async function updateDeviceType(id, patch) {
  const allowed = {};
  if (patch.name !== undefined) allowed.name = patch.name;
  if (patch.code !== undefined) allowed.code = patch.code;
  if (patch.icon !== undefined) allowed.icon = patch.icon;
  if (patch.color_code !== undefined) allowed.color_code = patch.color_code;

  if (Object.keys(allowed).length === 0) {
    const err = new Error('No valid fields to update');
    err.status = 400;
    throw err;
  }
  return prisma.device_type.update({ where: { id }, data: allowed });
}

export async function deleteDeviceType(id) {
  // Block delete if devices still reference this type
  const count = await prisma.devices.count({ where: { type_id: id } });
  if (count > 0) {
    const err = new Error(`Cannot delete — ${count} device(s) still use this type`);
    err.status = 409;
    throw err;
  }
  await prisma.device_type.delete({ where: { id } });
  return { ok: true };
}

// =====================================================================
// MASTER SENSORS
// =====================================================================

export async function listMasterSensors() {
  return prisma.master_sensor.findMany({
    orderBy: { name: 'asc' },
  });
}

export async function createMasterSensor(payload) {
  const { name, short_name, description, min_value, max_value, units, unit } = payload;
  return prisma.master_sensor.create({
    data: {
      name,
      short_name: short_name || null,
      description: description || null,
      min_value: min_value ?? null,
      max_value: max_value ?? null,
      units: units || {},
      unit: unit || null,
    },
  });
}

export async function updateMasterSensor(id, patch) {
  const allowed = {};
  if (patch.name !== undefined) allowed.name = patch.name;
  if (patch.short_name !== undefined) allowed.short_name = patch.short_name;
  if (patch.description !== undefined) allowed.description = patch.description;
  if (patch.min_value !== undefined) allowed.min_value = patch.min_value;
  if (patch.max_value !== undefined) allowed.max_value = patch.max_value;
  if (patch.units !== undefined) allowed.units = patch.units;
  if (patch.unit !== undefined) allowed.unit = patch.unit;

  if (Object.keys(allowed).length === 0) {
    const err = new Error('No valid fields to update');
    err.status = 400;
    throw err;
  }
  return prisma.master_sensor.update({ where: { id }, data: allowed });
}

export async function deleteMasterSensor(id) {
  await prisma.master_sensor.delete({ where: { id } });
  return { ok: true };
}