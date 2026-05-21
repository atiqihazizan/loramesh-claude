// routes/sensors.js
// Master sensor list — read for everyone, mutations for SUPERADMIN.

import express from 'express';
import { authenticateJwt } from '../middleware/auth-jwt.js';
import { requireSuperadmin } from '../middleware/auth-role.js';
import { validateId } from '../middleware/validation.js';
import {
  listMasterSensors,
  createMasterSensor,
  updateMasterSensor,
  deleteMasterSensor,
} from '../services/master-data-service.js';

const router = express.Router();

router.get('/', authenticateJwt, async (req, res, next) => {
  try {
    const sensors = await listMasterSensors();
    return res.json({ sensors });
  } catch (err) {
    return next(err);
  }
});

router.post('/', authenticateJwt, requireSuperadmin, async (req, res, next) => {
  try {
    const created = await createMasterSensor(req.body);
    return res.status(201).json({ sensor: created });
  } catch (err) {
    return next(err);
  }
});

router.patch('/:id', authenticateJwt, requireSuperadmin, validateId, async (req, res, next) => {
  try {
    const updated = await updateMasterSensor(parseInt(req.params.id, 10), req.body);
    return res.json({ sensor: updated });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

router.delete('/:id', authenticateJwt, requireSuperadmin, validateId, async (req, res, next) => {
  try {
    const result = await deleteMasterSensor(parseInt(req.params.id, 10));
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

export default router;