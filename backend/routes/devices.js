// routes/devices.js

import express from 'express';
import { authenticateJwt } from '../middleware/auth-jwt.js';
import { requireAgencyAdmin } from '../middleware/auth-role.js';
import { validateId, validateDeviceCreate } from '../middleware/validation.js';
import {
  listDevices,
  getDeviceById,
  approveDevice,
  createDevice,
  updateDevice,
  removeDevice,
} from '../services/device-service.js';

const router = express.Router();

// GET — any logged-in user (map markers need devices).
// listDevices() scopes non-SUPERADMIN to their own agency, so a
// regular user can never see another agency's devices.
router.get('/', authenticateJwt, async (req, res, next) => {
  try {
    const devices = await listDevices({
      user: req.user,
      agencyIdFilter: req.query.agency_id ? parseInt(req.query.agency_id, 10) : null,
      search: req.query.search,
      approval: req.query.approval || 'approved',
    });
    return res.json({ devices });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

router.get('/:id', authenticateJwt, validateId, async (req, res, next) => {
  try {
    const device = await getDeviceById(parseInt(req.params.id, 10), req.user);
    return res.json({ device });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

// Mutations — ADMIN_AGENCY+ only.
router.post(
  '/',
  authenticateJwt,
  requireAgencyAdmin,
  validateDeviceCreate,
  async (req, res, next) => {
    try {
      const device = await createDevice(req.body, req.user);
      return res.status(201).json({ device });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      return next(err);
    }
  }
);

router.patch('/:id', authenticateJwt, requireAgencyAdmin, validateId, async (req, res, next) => {
  try {
    const device = await updateDevice(parseInt(req.params.id, 10), req.body, req.user);
    return res.json({ device });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

// Approve a pending (self-registered) device. ADMIN_AGENCY+ only.
router.patch('/:id/approve', authenticateJwt, requireAgencyAdmin, validateId, async (req, res, next) => {
  try {
    const device = await approveDevice(parseInt(req.params.id, 10), req.user);
    return res.json({ device });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

router.delete('/:id', authenticateJwt, requireAgencyAdmin, validateId, async (req, res, next) => {
  try {
    const result = await removeDevice(parseInt(req.params.id, 10), req.user);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

export default router;
