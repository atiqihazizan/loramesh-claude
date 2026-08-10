// routes/sites.js

import express from 'express';
import { authenticateJwt } from '../middleware/auth-jwt.js';
import { requireAgencyAdmin } from '../middleware/auth-role.js';
import { validateId, validateSiteCreate } from '../middleware/validation.js';
import {
  listSites,
  getSiteById,
  createSite,
  updateSite,
  deleteSite,
} from '../services/site-service.js';

const router = express.Router();

// GET — any logged-in user (map page needs sites)
router.get('/', authenticateJwt, async (req, res, next) => {
  try {
    const sites = await listSites(
      req.user,
      req.query.agency_id ? parseInt(req.query.agency_id, 10) : null
    );
    return res.json({ sites });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

router.get('/:id', authenticateJwt, validateId, async (req, res, next) => {
  try {
    const site = await getSiteById(parseInt(req.params.id, 10), req.user);
    return res.json({ site });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

// Mutations — ADMIN_AGENCY+
router.post('/', authenticateJwt, requireAgencyAdmin, validateSiteCreate, async (req, res, next) => {
  try {
    const site = await createSite(req.body, req.user);
    return res.status(201).json({ site });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

router.patch('/:id', authenticateJwt, requireAgencyAdmin, validateId, async (req, res, next) => {
  try {
    const site = await updateSite(parseInt(req.params.id, 10), req.body, req.user);
    return res.json({ site });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

router.delete('/:id', authenticateJwt, requireAgencyAdmin, validateId, async (req, res, next) => {
  try {
    const result = await deleteSite(parseInt(req.params.id, 10), req.user);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

export default router;