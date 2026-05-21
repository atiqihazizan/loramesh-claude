// routes/provision.js
// Provisioning — admin creates enrollment codes; Flutter claims them.

import express from 'express';
import { authenticateJwt } from '../middleware/auth-jwt.js';
import { requireAgencyAdmin } from '../middleware/auth-role.js';
import { validateId } from '../middleware/validation.js';
import {
  createProvisioningNonce,
  listProvisioningNonces,
  revokeNonce,
  verifyNonce,
  claimNonce,
} from '../services/provisioning-service.js';

const router = express.Router();

// --------------------------------------------
// ADMIN — create enrollment nonce
// --------------------------------------------
router.post('/create', authenticateJwt, requireAgencyAdmin, async (req, res, next) => {
  try {
    const agencyId =
      req.user.level.code === 'SUPERADMIN' && req.body.agency_id
        ? parseInt(req.body.agency_id, 10)
        : req.user.agency?.id;

    if (!agencyId) return res.status(400).json({ error: 'Cannot resolve agency_id' });

    const result = await createProvisioningNonce({
      agencyId,
      label: req.body.label,
      maxClaims: req.body.max_claims ? parseInt(req.body.max_claims, 10) : null,
      createdBy: req.user.id,
    });
    return res.status(201).json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

// --------------------------------------------
// ADMIN — list nonces
// --------------------------------------------
router.get('/list', authenticateJwt, requireAgencyAdmin, async (req, res, next) => {
  try {
    const agencyId =
      req.user.level.code === 'SUPERADMIN' && req.query.agency_id
        ? parseInt(req.query.agency_id, 10)
        : req.user.agency?.id;
    if (!agencyId) return res.status(400).json({ error: 'Cannot resolve agency_id' });

    const nonces = await listProvisioningNonces(agencyId);
    return res.json({ nonces });
  } catch (err) {
    return next(err);
  }
});

// --------------------------------------------
// ADMIN — revoke nonce
// --------------------------------------------
router.delete('/:id', authenticateJwt, requireAgencyAdmin, validateId, async (req, res, next) => {
  try {
    const agencyId = req.user.agency?.id;
    const result = await revokeNonce(parseInt(req.params.id, 10), agencyId);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

// --------------------------------------------
// PUBLIC — Flutter verifies nonce before claiming
// --------------------------------------------
router.get('/verify/:nonce', async (req, res, next) => {
  try {
    const result = await verifyNonce(req.params.nonce);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// --------------------------------------------
// PUBLIC — Flutter claims nonce → gets agency_token
// --------------------------------------------
router.post('/claim', async (req, res, next) => {
  try {
    const { nonce, device_mac, device_model, device_os } = req.body;
    if (!nonce) return res.status(400).json({ error: 'nonce required' });

    const result = await claimNonce({ nonce, device_mac, device_model, device_os });
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message, code: err.code });
    return next(err);
  }
});

export default router;