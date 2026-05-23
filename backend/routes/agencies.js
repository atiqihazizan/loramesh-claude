// routes/agencies.js
// SUPERADMIN-only agency CRUD.

import express from 'express';
import { authenticateJwt } from '../middleware/auth-jwt.js';
import { requireSuperadmin, requireAgencyAdmin, canAccessAgency } from '../middleware/auth-role.js';
import {
  validateId,
  validateAgencyCreate,
  validateAgencySettings,
} from '../middleware/validation.js';
import {
  listAgencies,
  getAgencyById,
  createAgency,
  updateAgency,
  rotateAgencyToken,
  disableAgency,
} from '../services/agency-service.js';
import {
  generateAgencyToken,
  endAgencyToken,
  getAgencyTokenStatus,
} from '../services/provisioning-service.js';

const router = express.Router();

router.get('/', authenticateJwt, requireSuperadmin, async (req, res, next) => {
  try {
    const includeInactive = req.query.include_inactive === 'true';
    const agencies = await listAgencies({ includeInactive });
    return res.json({ agencies });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', authenticateJwt, requireSuperadmin, validateId, async (req, res, next) => {
  try {
    const includeToken = req.query.include_token === 'true';
    const agency = await getAgencyById(parseInt(req.params.id, 10), { includeToken });
    return res.json({ agency });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

router.post(
  '/',
  authenticateJwt,
  requireSuperadmin,
  validateAgencyCreate,
  async (req, res, next) => {
    try {
      const result = await createAgency(req.body);
      return res.status(201).json(result);
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      return next(err);
    }
  }
);

router.patch(
  '/:id',
  authenticateJwt,
  requireSuperadmin,
  validateId,
  validateAgencySettings,
  async (req, res, next) => {
    try {
      const agency = await updateAgency(parseInt(req.params.id, 10), req.body);
      return res.json({ agency });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      return next(err);
    }
  }
);

router.post(
  '/:id/rotate-token',
  authenticateJwt,
  requireSuperadmin,
  validateId,
  async (req, res, next) => {
    try {
      const result = await rotateAgencyToken(parseInt(req.params.id, 10));
      return res.json(result);
    } catch (err) {
      return next(err);
    }
  }
);

router.delete(
  '/:id',
  authenticateJwt,
  requireSuperadmin,
  validateId,
  async (req, res, next) => {
    try {
      const result = await disableAgency(parseInt(req.params.id, 10));
      return res.json(result);
    } catch (err) {
      return next(err);
    }
  }
);

// ── E5-c: provisioning token (ADMIN_AGENCY+ own agency; SUPERADMIN any) ──

router.get(
  '/:id/provision-token',
  authenticateJwt,
  requireAgencyAdmin,
  validateId,
  async (req, res, next) => {
    try {
      const agencyId = parseInt(req.params.id, 10);
      if (!canAccessAgency(req.user, agencyId)) {
        return res.status(403).json({ error: 'Forbidden — agency mismatch' });
      }
      const result = await getAgencyTokenStatus(agencyId);
      return res.json(result);
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      return next(err);
    }
  }
);

router.post(
  '/:id/provision-token',
  authenticateJwt,
  requireAgencyAdmin,
  validateId,
  async (req, res, next) => {
    try {
      const agencyId = parseInt(req.params.id, 10);
      if (!canAccessAgency(req.user, agencyId)) {
        return res.status(403).json({ error: 'Forbidden — agency mismatch' });
      }
      const result = await generateAgencyToken(agencyId);
      return res.status(201).json(result);
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      return next(err);
    }
  }
);

router.delete(
  '/:id/provision-token',
  authenticateJwt,
  requireAgencyAdmin,
  validateId,
  async (req, res, next) => {
    try {
      const agencyId = parseInt(req.params.id, 10);
      if (!canAccessAgency(req.user, agencyId)) {
        return res.status(403).json({ error: 'Forbidden — agency mismatch' });
      }
      const result = await endAgencyToken(agencyId);
      return res.json(result);
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      return next(err);
    }
  }
);

export default router;