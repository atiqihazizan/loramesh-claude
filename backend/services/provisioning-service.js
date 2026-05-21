// services/provisioning-service.js
// APK enrollment via nonce. DEMO MODE — simple, minimal security.
//
// ════════════════════════════════════════════════════════════════════
// SECURITY NOTE (read before production):
//   Demo behaviour:
//     - Nonce never enforces max_claims (unlimited claims until expiry)
//     - No rate limiting on /claim beyond global limiter
//     - Nonce is a short human-typable code (lower entropy)
//   For production, enable the TODO blocks below:
//     - Enforce claim_count < max_claims
//     - Use longer random nonce / signed token
//     - Rate-limit claim attempts per IP
//     - Optionally require admin approval per claim
// ════════════════════════════════════════════════════════════════════

import crypto from 'node:crypto';
import prisma from '../lib/prisma.js';
import { env } from '../config/env.js';
import {
  loadDeviceCache,
} from '../lib/cache/device-cache.js';
import {
  loadDeviceStaticCache,
} from '../lib/cache/device-static-cache.js';
import {
  assignDeviceToAgencyInCache,
} from '../lib/cache/device-agency-cache.js';

// =====================================================================
// NONCE GENERATION
// =====================================================================

/**
 * Generate a short, human-typable nonce like "PILOT-7K3M-9XQ2".
 * DEMO: low entropy is fine. Production should use longer random.
 */
function generateNonceCode(agencyCode) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing chars (0/O, 1/I)
  const block = () => {
    let s = '';
    for (let i = 0; i < 4; i++) {
      s += alphabet[crypto.randomInt(alphabet.length)];
    }
    return s;
  };
  const prefix = (agencyCode || 'AG').toUpperCase().slice(0, 6);
  return `${prefix}-${block()}-${block()}`;
}

// =====================================================================
// CREATE NONCE (admin generates enrollment code)
// =====================================================================

export async function createProvisioningNonce({ agencyId, label, maxClaims, createdBy }) {
  // Generate unique nonce (retry on collision — very unlikely)
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { code: true, name: true },
  });
  if (!agency) {
    const err = new Error('Agency not found');
    err.status = 404;
    throw err;
  }

  let nonce;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateNonceCode(agency.code);
    const exists = await prisma.provisioning_nonce.findUnique({ where: { nonce: candidate } });
    if (!exists) {
      nonce = candidate;
      break;
    }
  }
  if (!nonce) throw new Error('Failed to generate unique nonce');

  const expiresAt = new Date(Date.now() + env.PROVISIONING_NONCE_TTL_MIN * 60 * 1000);

  const row = await prisma.provisioning_nonce.create({
    data: {
      nonce,
      agency_id: agencyId,
      label: label || null,
      max_claims: maxClaims || null, // null = unlimited (demo)
      claim_count: 0,
      expires_at: expiresAt,
      created_by: createdBy || null,
    },
  });

  // QR payload — what the Flutter app scans
  const qrPayload = {
    type: 'lora_enroll',
    nonce: row.nonce,
    agency: agency.code,
    api: env.API_BASE_URL,
  };

  return {
    id: row.id,
    nonce: row.nonce,
    label: row.label,
    agency: { id: agencyId, code: agency.code, name: agency.name },
    expires_at: row.expires_at,
    claim_count: 0,
    max_claims: row.max_claims,
    qr_payload: qrPayload,
    qr_string: JSON.stringify(qrPayload),
  };
}

// =====================================================================
// LIST NONCES (admin views active enrollment codes)
// =====================================================================

export async function listProvisioningNonces(agencyId) {
  const now = new Date();
  const rows = await prisma.provisioning_nonce.findMany({
    where: { agency_id: agencyId },
    orderBy: { created_at: 'desc' },
  });

  return rows.map((r) => ({
    id: r.id,
    nonce: r.nonce,
    label: r.label,
    claim_count: r.claim_count,
    max_claims: r.max_claims,
    expires_at: r.expires_at,
    is_expired: r.expires_at < now,
    created_at: r.created_at,
  }));
}

// =====================================================================
// REVOKE NONCE
// =====================================================================

export async function revokeNonce(id, agencyId) {
  const row = await prisma.provisioning_nonce.findUnique({ where: { id } });
  if (!row) {
    const err = new Error('Nonce not found');
    err.status = 404;
    throw err;
  }
  if (row.agency_id !== agencyId) {
    const err = new Error('Forbidden — nonce belongs to another agency');
    err.status = 403;
    throw err;
  }
  // Revoke = set expiry to now
  await prisma.provisioning_nonce.update({
    where: { id },
    data: { expires_at: new Date() },
  });
  return { ok: true };
}

// =====================================================================
// VERIFY NONCE (Flutter checks before claiming)
// =====================================================================

export async function verifyNonce(nonceCode) {
  const row = await prisma.provisioning_nonce.findUnique({
    where: { nonce: nonceCode },
    include: { agency: { select: { code: true, name: true, status: true } } },
  });

  if (!row) {
    return { valid: false, reason: 'not_found' };
  }
  if (row.expires_at < new Date()) {
    return { valid: false, reason: 'expired' };
  }
  if (!row.agency.status) {
    return { valid: false, reason: 'agency_inactive' };
  }

  // TODO production: enforce max_claims
  // if (row.max_claims && row.claim_count >= row.max_claims) {
  //   return { valid: false, reason: 'claim_limit_reached' };
  // }

  return {
    valid: true,
    agency: { code: row.agency.code, name: row.agency.name },
    label: row.label,
  };
}

// =====================================================================
// CLAIM NONCE (Flutter enrolls a device)
// =====================================================================

/**
 * Flutter app submits nonce + device info → backend creates device,
 * links to agency, returns agency_token.
 *
 * @param {object} input
 * @param {string} input.nonce
 * @param {string} input.device_mac
 * @param {string} [input.device_model]
 * @param {string} [input.device_os]
 * @param {string} [input.device_id]   - optional; auto-generated if missing
 */
export async function claimNonce(input) {
  const { nonce, device_mac, device_model, device_os } = input;

  const row = await prisma.provisioning_nonce.findUnique({
    where: { nonce },
    include: { agency: true },
  });

  if (!row) {
    const err = new Error('Invalid enrollment code');
    err.code = 'NONCE_NOT_FOUND';
    err.status = 404;
    throw err;
  }
  if (row.expires_at < new Date()) {
    const err = new Error('Enrollment code expired');
    err.code = 'NONCE_EXPIRED';
    err.status = 410;
    throw err;
  }
  if (!row.agency.status) {
    const err = new Error('Agency is inactive');
    err.code = 'AGENCY_INACTIVE';
    err.status = 403;
    throw err;
  }

  // TODO production: enforce max_claims
  // if (row.max_claims && row.claim_count >= row.max_claims) {
  //   const err = new Error('Enrollment code claim limit reached');
  //   err.code = 'CLAIM_LIMIT';
  //   err.status = 409;
  //   throw err;
  // }

  // ----- Resolve / generate device_id -----
  // Demo rule: if device already exists by MAC, reuse it; else create new.
  let device = null;
  if (device_mac) {
    device = await prisma.devices.findFirst({ where: { device_mac } });
  }

  // Default name: "{model} - {last4 MAC}"
  const last4 = device_mac ? device_mac.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() : 'XXXX';
  const defaultName = `${device_model || 'Device'} - ${last4}`;

  const result = await prisma.$transaction(async (tx) => {
    if (!device) {
      // Generate device_id from MAC or random
      const generatedId = device_mac
        ? `MG-${device_mac.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}`
        : `MG-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

      device = await tx.devices.create({
        data: {
          device_id: generatedId,
          device_mac: device_mac || null,
          name: defaultName,
          data_type: 'MG',
          is_static: false,
          logging_enabled: true,
          status: 'offline',
          metadata: {
            device_model: device_model || null,
            device_os: device_os || null,
            enrolled_via: nonce,
          },
        },
      });
    }

    // Link device → agency (if not already linked)
    const existingLink = await tx.device_agency.findUnique({
      where: {
        device_id_agency_id: { device_id: device.id, agency_id: row.agency_id },
      },
    });
    if (!existingLink) {
      await tx.device_agency.create({
        data: {
          device_id: device.id,
          agency_id: row.agency_id,
          name: device.name,
          active: true,
        },
      });
    } else if (!existingLink.active) {
      await tx.device_agency.update({
        where: { id: existingLink.id },
        data: { active: true, deactivated_at: null },
      });
    }

    // Increment claim count + mark used
    await tx.provisioning_nonce.update({
      where: { id: row.id },
      data: {
        claim_count: { increment: 1 },
        used_at: row.used_at || new Date(),
      },
    });

    return device;
  });

  // Update caches
  await Promise.all([loadDeviceCache(), loadDeviceStaticCache()]);
  assignDeviceToAgencyInCache(result.device_id, row.agency.agency_token);

  // Return agency_token — Flutter uses this for all future requests
  return {
    ok: true,
    device: {
      id: result.id,
      device_id: result.device_id,
      name: result.name,
    },
    agency: {
      code: row.agency.code,
      name: row.agency.name,
    },
    agency_token: row.agency.agency_token,
    api_base_url: env.API_BASE_URL,
  };
}