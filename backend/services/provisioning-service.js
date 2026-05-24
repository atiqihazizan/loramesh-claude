// services/provisioning-service.js
// E5-c — agency provisioning token. One token per agency, with expiry.
// The token IS agency.agency_token. APK scans the QR (token) to enroll
// a device automatically. Token is a temporary entry pass, not a licence.

import crypto from 'node:crypto';
import prisma from '../lib/prisma.js';
import { env } from '../config/env.js';
import { refreshAgencyInCache } from '../lib/cache/agency-cache.js';

// Generate a random agency token.
function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}

// How long a freshly generated token stays valid.
function expiryFromNow() {
  const minutes = env.PROVISIONING_NONCE_TTL_MIN || 1440;
  return new Date(Date.now() + minutes * 60 * 1000);
}

/**
 * Generate a new token for an agency. Blocked if the current token
 * is still valid — caller must end it first.
 */
export async function generateAgencyToken(agencyId) {
  const agency = await prisma.agency.findUnique({ where: { id: agencyId } });
  if (!agency) {
    const err = new Error('Agency not found');
    err.status = 404;
    throw err;
  }

  const now = new Date();
  const stillValid =
    agency.agency_token &&
    agency.agency_token_expires_at &&
    agency.agency_token_expires_at > now;
  if (stillValid) {
    const err = new Error('Current token is still valid — end it first');
    err.status = 409;
    throw err;
  }

  const token = generateToken();
  const expiresAt = expiryFromNow();
  const updated = await prisma.agency.update({
    where: { id: agencyId },
    data: { agency_token: token, agency_token_expires_at: expiresAt },
  });

  await refreshAgencyInCache(agencyId);

  return {
    agency_token: updated.agency_token,
    agency_token_expires_at: updated.agency_token_expires_at,
  };
}

/**
 * End the current token immediately (set expiry to now).
 * Token value is kept but becomes invalid.
 */
export async function endAgencyToken(agencyId) {
  const agency = await prisma.agency.findUnique({ where: { id: agencyId } });
  if (!agency) {
    const err = new Error('Agency not found');
    err.status = 404;
    throw err;
  }
  const updated = await prisma.agency.update({
    where: { id: agencyId },
    data: { agency_token_expires_at: new Date() },
  });

  await refreshAgencyInCache(agencyId);

  return {
    agency_token_expires_at: updated.agency_token_expires_at,
  };
}

/**
 * Read the current token status for an agency.
 */
export async function getAgencyTokenStatus(agencyId) {
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: {
      id: true,
      code: true,
      name: true,
      agency_token: true,
      agency_token_expires_at: true,
    },
  });
  if (!agency) {
    const err = new Error('Agency not found');
    err.status = 404;
    throw err;
  }
  const now = new Date();
  const isValid =
    !!agency.agency_token &&
    !!agency.agency_token_expires_at &&
    agency.agency_token_expires_at > now;
  return {
    agency_id: agency.id,
    agency_code: agency.code,
    agency_name: agency.name,
    agency_token: isValid ? agency.agency_token : null,
    agency_token_expires_at: agency.agency_token_expires_at,
    is_valid: isValid,
  };
}
