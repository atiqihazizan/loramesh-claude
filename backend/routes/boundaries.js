// routes/boundaries.js

import express from 'express';
import { authenticateJwt } from '../middleware/auth-jwt.js';
import { requireAgencyAdmin } from '../middleware/auth-role.js';
import { validateId } from '../middleware/validation.js';
import {
  listBoundaries,
  getBoundaryById,
  createBoundary,
  updateBoundary,
  deleteBoundary,
} from '../services/boundary-service.js';

const router = express.Router();

router.get('/', authenticateJwt, async (req, res, next) => {
  try {
    const fc = await listBoundaries(
      req.user,
      req.query.agency_id ? parseInt(req.query.agency_id, 10) : null
    );
    return res.json(fc);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

router.get('/:id', authenticateJwt, validateId, async (req, res, next) => {
  try {
    const feature = await getBoundaryById(parseInt(req.params.id, 10), req.user);
    return res.json(feature);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

router.post('/', authenticateJwt, requireAgencyAdmin, async (req, res, next) => {
  try {
    const feature = await createBoundary(req.body, req.user);
    return res.status(201).json(feature);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

router.patch('/:id', authenticateJwt, requireAgencyAdmin, validateId, async (req, res, next) => {
  try {
    const feature = await updateBoundary(parseInt(req.params.id, 10), req.body, req.user);
    return res.json(feature);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

router.delete('/:id', authenticateJwt, requireAgencyAdmin, validateId, async (req, res, next) => {
  try {
    const result = await deleteBoundary(parseInt(req.params.id, 10), req.user);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

export default router;
