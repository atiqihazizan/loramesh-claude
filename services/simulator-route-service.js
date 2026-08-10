// services/simulator-route-service.js
// CRUD laluan simulator — satu route per device_id.

import prisma from '../lib/prisma.js';

function err400(msg) { const e = new Error(msg); e.status = 400; return e; }
function err404(msg) { const e = new Error(msg); e.status = 404; return e; }

function normalizeRoute(input) {
  if (!Array.isArray(input) || input.length < 2) {
    throw err400('route perlu array sekurang-kurangnya 2 titik [[lat,lng], ...]');
  }
  return input.map((p, i) => {
    if (!Array.isArray(p) || p.length < 2) {
      throw err400(`titik #${i + 1} mesti [lat, lng]`);
    }
    const lat = Number(p[0]);
    const lng = Number(p[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw err400(`titik #${i + 1} koordinat tidak sah`);
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw err400(`titik #${i + 1} di luar julat sah`);
    }
    return [+lat.toFixed(6), +lng.toFixed(6)];
  });
}

function rowToDto(row) {
  return {
    id: row.id,
    device_id: row.device_id,
    route: row.route,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listSimulatorRoutes() {
  const rows = await prisma.simulator_routes.findMany({
    orderBy: { updated_at: 'desc' },
  });
  return rows.map(rowToDto);
}

export async function getSimulatorRoute(deviceId) {
  const row = await prisma.simulator_routes.findUnique({
    where: { device_id: deviceId },
  });
  if (!row) throw err404('Route tidak dijumpai untuk device ini');
  return rowToDto(row);
}

export async function saveSimulatorRoute(deviceId, routeInput) {
  const deviceIdStr = String(deviceId || '').trim();
  if (!deviceIdStr) throw err400('device_id diperlukan');

  const device = await prisma.devices.findUnique({ where: { device_id: deviceIdStr } });
  if (!device) throw err404('Device tidak dijumpai');

  const route = normalizeRoute(routeInput);

  const row = await prisma.simulator_routes.upsert({
    where: { device_id: deviceIdStr },
    create: { device_id: deviceIdStr, route },
    update: { route },
  });
  return rowToDto(row);
}

export async function deleteSimulatorRoute(deviceId) {
  const deviceIdStr = String(deviceId || '').trim();
  if (!deviceIdStr) throw err400('device_id diperlukan');

  const existing = await prisma.simulator_routes.findUnique({
    where: { device_id: deviceIdStr },
  });
  if (!existing) throw err404('Route tidak dijumpai untuk device ini');

  await prisma.simulator_routes.delete({ where: { device_id: deviceIdStr } });
  return { ok: true, device_id: deviceIdStr };
}
