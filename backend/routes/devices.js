// routes/devices.js

import express from 'express';
import { authenticateJwt } from '../middleware/auth-jwt.js';
import { requireAgencyAdmin } from '../middleware/auth-role.js';
import { validateId, validateDeviceCreate } from '../middleware/validation.js';
import {
  listDevices,
  getDeviceById,
  createDevice,
  updateDevice,
  removeDevice,
} from '../services/device-service.js';

const router = express.Router();

router.get('/', authenticateJwt, requireAgencyAdmin, async (req, res, next) => {
  try {
    const devices = await listDevices({
      user: req.user,
      agencyIdFilter: req.query.agency_id ? parseInt(req.query.agency_id, 10) : null,
      search: req.query.search,
    });
    return res.json({ devices });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

router.get('/:id', authenticateJwt, requireAgencyAdmin, validateId, async (req, res, next) => {
  try {
    const device = await getDeviceById(parseInt(req.params.id, 10), req.user);
    return res.json({ device });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

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