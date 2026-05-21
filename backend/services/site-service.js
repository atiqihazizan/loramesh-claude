// services/site-service.js
// Site CRUD — agency-scoped monitoring zones.

import prisma from '../lib/prisma.js';
import { ROLES } from '../config/constants.js';

function resolveAgencyId(user, explicitId) {
  if (user.level.code === ROLES.SUPERADMIN) {
    return explicitId || user.agency?.id || null;
  }
  return user.agency?.id || null;
}

export async function listSites(user, agencyIdFilter) {
  const agencyId = resolveAgencyId(user, agencyIdFilter);

  const where = {};
  if (agencyId) where.agency_id = agencyId;
  // SUPERADMIN with no filter → all sites

  const sites = await prisma.sites.findMany({
    where,
    orderBy: { created_at: 'desc' },
  });
  return sites;
}

export async function getSiteById(id, user) {
  const site = await prisma.sites.findUnique({ where: { id } });
  if (!site) {
    const err = new Error('Site not found');
    err.status = 404;
    throw err;
  }
  if (user.level.code !== ROLES.SUPERADMIN && site.agency_id !== user.agency?.id) {
    const err = new Error('Forbidden — site not in your agency');
    err.status = 403;
    throw err;
  }
  return site;
}

export async function createSite(payload, user) {
  const agencyId = resolveAgencyId(user, payload.agency_id);
  if (!agencyId) {
    const err = new Error('Cannot resolve agency_id');
    err.status = 400;
    throw err;
  }

  const site = await prisma.sites.create({
    data: {
      agency_id: agencyId,
      name: payload.name,
      latlng: payload.latlng || null,
      zoom: payload.zoom ?? 13,
      path: payload.path || null,
      tile_url: payload.tile_url || undefined, // use schema default if not given
      slug: payload.slug || null,
      publish: payload.publish ?? false,
      status: true,
      created_by: user.id,
      updated_by: user.id,
    },
  });
  return site;
}

export async function updateSite(id, patch, user) {
  await getSiteById(id, user); // access check

  const allowed = {};
  if (patch.name !== undefined) allowed.name = patch.name;
  if (patch.latlng !== undefined) allowed.latlng = patch.latlng;
  if (patch.zoom !== undefined) allowed.zoom = patch.zoom;
  if (patch.path !== undefined) allowed.path = patch.path;
  if (patch.tile_url !== undefined) allowed.tile_url = patch.tile_url;
  if (patch.slug !== undefined) allowed.slug = patch.slug;
  if (patch.publish !== undefined) allowed.publish = patch.publish;
  if (patch.status !== undefined) allowed.status = patch.status;
  allowed.updated_by = user.id;

  if (Object.keys(allowed).length <= 1) {
    const err = new Error('No valid fields to update');
    err.status = 400;
    throw err;
  }

  return prisma.sites.update({ where: { id }, data: allowed });
}

export async function deleteSite(id, user) {
  await getSiteById(id, user); // access check
  await prisma.sites.delete({ where: { id } });
  return { ok: true };
}