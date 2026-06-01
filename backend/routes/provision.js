// routes/provision.js
// Public provisioning verify — APK redeems agency_token from scanned QR payload.

import express from 'express';
import crypto from 'node:crypto';
import prisma from '../lib/prisma.js';

const router = express.Router();

const ALGO = 'aes-256-cbc';
const KEY = process.env.PROVISION_ENCRYPTION_KEY || 'default-32-char-encryption-key!!';
const IV_LEN = 16;

// 32-byte key buffer (pad/truncate — must match frontend provisioningQr.js).
function keyBuffer() {
  return Buffer.from(KEY.padEnd(32, '0').substring(0, 32));
}

// Decrypt hex(IV + ciphertext) → object, or null on any failure.
function decryptPayload(hexString) {
  try {
    const buf = Buffer.from(hexString, 'hex');
    const iv = buf.subarray(0, IV_LEN);
    const enc = buf.subarray(IV_LEN);
    const decipher = crypto.createDecipheriv(ALGO, keyBuffer(), iv);
    const decrypted = Buffer.concat([decipher.update(enc), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
  } catch {
    return null;
  }
}

// Token fingerprint — must match frontend stableNonce().
function computeNonce(agencyId, agencyToken) {
  return crypto
    .createHash('sha256')
    .update(`${agencyId}:${agencyToken}`)
    .digest('hex')
    .slice(0, 32);
}

// POST /verify — public, no auth (APK has no token yet).
router.post('/verify', async (req, res) => {
  try {
    const { payload } = req.body || {};
    if (!payload || typeof payload !== 'string') {
      return res.status(400).json({ success: false, error: 'INVALID_REQUEST' });
    }

    const decrypted = decryptPayload(payload);
    if (!decrypted) {
      return res.status(400).json({ success: false, error: 'DECRYPTION_FAILED' });
    }

    const { agency_id, nonce, expires_at } = decrypted;
    if (agency_id == null || !nonce || !expires_at) {
      return res.status(400).json({ success: false, error: 'INVALID_PAYLOAD' });
    }

    if (new Date() > new Date(expires_at)) {
      return res.status(400).json({ success: false, error: 'PAYLOAD_EXPIRED' });
    }

    const agency = await prisma.agency.findUnique({
      where: { id: parseInt(agency_id, 10) },
    });
    if (!agency) {
      return res.status(404).json({ success: false, error: 'AGENCY_NOT_FOUND' });
    }
    if (!agency.status) {
      return res.status(403).json({ success: false, error: 'AGENCY_INACTIVE' });
    }
    if (!agency.agency_token) {
      return res.status(500).json({ success: false, error: 'AGENCY_TOKEN_MISSING' });
    }

    if (
      agency.agency_token_expires_at &&
      new Date(agency.agency_token_expires_at) < new Date()
    ) {
      return res.status(400).json({ success: false, error: 'TOKEN_EXPIRED' });
    }

    const expected = computeNonce(agency.id, agency.agency_token);
    if (expected !== nonce) {
      return res.status(401).json({ success: false, error: 'NONCE_MISMATCH' });
    }

    return res.status(200).json({
      success: true,
      agency_token: agency.agency_token,
      agency_id: agency.id,
      agency_code: agency.code,
      agency_name: agency.name,
    });
  } catch {
    return res.status(500).json({ success: false, error: 'INTERNAL_ERROR' });
  }
});

export default router;