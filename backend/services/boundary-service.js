// services/boundary-service.js
// Boundary CRUD — agency-scoped geo polygons (Polygon | MultiPolygon).

import prisma from '../lib/prisma.js';
import { ROLES } from '../config/constants.js';

function resolveAgencyId(user, explicitId) {
  if (user.level.code === ROLES.SUPERADMIN) {
    return explicitId || user.agency?.id || null;
  }
  return user.agency?.id || null;
}

function err400(msg) { const e = new Error(msg); e.status = 400; return e; }

function isLngLat(p) {
  if (!Array.isArray(p) || p.length < 2) return false;
  const [lng, lat] = p.map(Number);
  return Number.isFinite(lng) && Number.isFinite(lat) &&
    lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
}

function isValidGeometry(g) {
  if (!g || typeof g !== 'object') return false;
  if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
    return Array.isArray(g.coordinates) && g.coordinates.length > 0;
  }
  return false;
}

function normalizeToGeometry(input) {
  if (Array.isArray(input)) {
    if (input.length < 3) throw err400('coordinates perlu sekurang-kurangnya 3 titik');
    const ring = input.map((p) => {
      if (!Array.isArray(p) || p.length < 2) throw err400('setiap titik mesti [lat,lng]');
      const [lat, lng] = p.map(Number);
      if (!isLngLat([lng, lat])) throw err400('titik di luar julat sah');
      return [lng, lat];
    });
    const a = ring[0], b = ring[ring.length - 1];
    if (a[0] !== b[0] || a[1] !== b[1]) ring.push([a[0], a[1]]);
    return { type: 'Polygon', coordinates: [ring] };
  }

  let geom = input;
  if (input && input.type === 'Feature') geom = input.geometry;

  if (!isValidGeometry(geom)) {
    throw err400('geometri mesti Polygon atau MultiPolygon yang sah');
  }
  return geom;
}

function rowToFeature(b) {
  return {
    type: 'Feature',
    properties: {
      id: b.id,
      name: b.name,
      visible: b.visible,
      agency_id: b.agency_id,
      agency_name: b.agency?.name ?? null,
    },
    geometry: b.coordinates,
  };
}

/** Pecah GeoJSON upload → senarai { geometry, suggestedName? }. MultiPolygon kekal satu baris. */
function extractGeometries(geojson) {
  if (!geojson || typeof geojson !== 'object') {
    throw err400('geojson tidak sah');
  }

  const items = [];

  const pushGeometry = (geometry, suggestedName) => {
    if (!isValidGeometry(geometry)) return;
    items.push({
      geometry,
      suggestedName: typeof suggestedName === 'string' ? suggestedName : undefined,
    });
  };

  switch (geojson.type) {
    case 'GeometryCollection':
      for (const g of geojson.geometries || []) {
        pushGeometry(g);
      }
      break;
    case 'FeatureCollection':
      for (const f of geojson.features || []) {
        pushGeometry(f?.geometry, f?.properties?.name);
      }
      break;
    case 'Feature':
      pushGeometry(geojson.geometry, geojson.properties?.name);
      break;
    case 'Polygon':
    case 'MultiPolygon':
      pushGeometry(geojson);
      break;
    default:
      throw err400(`Jenis GeoJSON tidak disokong: ${geojson.type}`);
  }

  if (items.length === 0) {
    throw err400('Tiada Polygon atau MultiPolygon ditemui dalam fail');
  }

  return items;
}

export async function listBoundaries(user, agencyIdFilter) {
  const agencyId = resolveAgencyId(user, agencyIdFilter);

  const where = {};
  if (agencyId) where.agency_id = agencyId;

  const rows = await prisma.boundaries.findMany({
    where,
    include: { agency: { select: { id: true, name: true } } },
    orderBy: { created_at: 'desc' },
  });

  return {
    type: 'FeatureCollection',
    features: rows.map(rowToFeature),
  };
}

export async function getBoundaryById(id, user) {
  const b = await prisma.boundaries.findUnique({
    where: { id },
    include: { agency: { select: { id: true, name: true } } },
  });
  if (!b) {
    const err = new Error('Boundary not found');
    err.status = 404;
    throw err;
  }
  if (user.level.code !== ROLES.SUPERADMIN && b.agency_id !== user.agency?.id) {
    const err = new Error('Forbidden — boundary not in your agency');
    err.status = 403;
    throw err;
  }
  return rowToFeature(b);
}

export async function createBoundary(payload, user) {
  const agencyId = resolveAgencyId(user, payload.agency_id);
  if (!agencyId) {
    const err = new Error('Cannot resolve agency_id');
    err.status = 400;
    throw err;
  }
  if (!payload.name || !payload.name.trim()) {
    throw err400('name diperlukan');
  }
  const geometry = normalizeToGeometry(payload.coordinates);

  const created = await prisma.boundaries.create({
    data: {
      agency_id: agencyId,
      name: payload.name.trim(),
      visible: payload.visible ?? true,
      coordinates: geometry,
      created_by: user.id,
      updated_by: user.id,
    },
    include: { agency: { select: { id: true, name: true } } },
  });
  return rowToFeature(created);
}

export async function updateBoundary(id, patch, user) {
  const existing = await prisma.boundaries.findUnique({ where: { id } });
  if (!existing) {
    const err = new Error('Boundary not found');
    err.status = 404;
    throw err;
  }
  if (user.level.code !== ROLES.SUPERADMIN && existing.agency_id !== user.agency?.id) {
    const err = new Error('Forbidden — boundary not in your agency');
    err.status = 403;
    throw err;
  }

  const data = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.visible !== undefined) data.visible = patch.visible;
  if (patch.coordinates !== undefined) {
    data.coordinates = normalizeToGeometry(patch.coordinates);
  }
  data.updated_by = user.id;

  if (Object.keys(data).length <= 1) {
    throw err400('No valid fields to update');
  }

  const updated = await prisma.boundaries.update({
    where: { id },
    data,
    include: { agency: { select: { id: true, name: true } } },
  });
  return rowToFeature(updated);
}

export async function uploadBoundaries(payload, user) {
  const agencyId = resolveAgencyId(user, payload.agency_id);
  if (!agencyId) {
    const err = new Error('Cannot resolve agency_id');
    err.status = 400;
    throw err;
  }
  if (!payload.geojson) {
    throw err400('geojson diperlukan');
  }

  const items = extractGeometries(payload.geojson);
  const prefix = (payload.name_prefix || 'Zon').trim() || 'Zon';
  const visible = payload.visible ?? true;
  let autoIndex = 1;

  const features = await prisma.$transaction(async (tx) => {
    const results = [];
    for (const item of items) {
      const name = item.suggestedName?.trim() || `${prefix} ${autoIndex}`;
      if (!item.suggestedName?.trim()) autoIndex += 1;

      const row = await tx.boundaries.create({
        data: {
          agency_id: agencyId,
          name,
          visible,
          coordinates: item.geometry,
          created_by: user.id,
          updated_by: user.id,
        },
        include: { agency: { select: { id: true, name: true } } },
      });
      results.push(rowToFeature(row));
    }
    return results;
  });

  return {
    created: features.length,
    type: 'FeatureCollection',
    features,
  };
}

export async function deleteBoundary(id, user) {
  const existing = await prisma.boundaries.findUnique({ where: { id } });
  if (!existing) {
    const err = new Error('Boundary not found');
    err.status = 404;
    throw err;
  }
  if (user.level.code !== ROLES.SUPERADMIN && existing.agency_id !== user.agency?.id) {
    const err = new Error('Forbidden — boundary not in your agency');
    err.status = 403;
    throw err;
  }
  await prisma.boundaries.delete({ where: { id } });
  return { ok: true };
}
