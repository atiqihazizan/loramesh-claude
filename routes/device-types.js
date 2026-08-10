// routes/device-types.js
// Master device type list — read-only for everyone, mutations for SUPERADMIN.

import express from 'express';
import { authenticateJwt } from '../middleware/auth-jwt.js';
import { requireSuperadmin } from '../middleware/auth-role.js';
import { validateId } from '../middleware/validation.js';
import {
  listDeviceTypes,
  createDeviceType,
  updateDeviceType,
  deleteDeviceType,
} from '../services/master-data-service.js';

const router = express.Router();

router.get('/', authenticateJwt, async (req, res, next) => {
  try {
    const types = await listDeviceTypes();
    return res.json({ device_types: types });
  } catch (err) {
    return next(err);
  }
});

router.post('/', authenticateJwt, requireSuperadmin, async (req, res, next) => {
  try {
    const created = await createDeviceType(req.body);
    return res.status(201).json({ device_type: created });
  } catch (err) {
    return next(err);
  }
});

router.patch('/:id', authenticateJwt, requireSuperadmin, validateId, async (req, res, next) => {
  try {
    const updated = await updateDeviceType(parseInt(req.params.id, 10), req.body);
    return res.json({ device_type: updated });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

router.delete('/:id', authenticateJwt, requireSuperadmin, validateId, async (req, res, next) => {
  try {
    const result = await deleteDeviceType(parseInt(req.params.id, 10));
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

export default router;