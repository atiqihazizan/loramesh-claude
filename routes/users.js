// routes/users.js
// SUPERADMIN-only global user management.

import express from 'express';
import { authenticateJwt } from '../middleware/auth-jwt.js';
import { requireSuperadmin } from '../middleware/auth-role.js';
import {
  validateId,
  validateUserCreate,
  validateUserUpdate,
  validatePasswordReset,
  validatePagination,
} from '../middleware/validation.js';
import {
  listAllUsers,
  getUserById,
  createUserGlobal,
  updateUserGlobal,
  moveUserToAgency,
  disableUserGlobal,
  listLevels,
} from '../services/user-service.js';
import { resetUserPassword } from '../services/auth-service.js';

const router = express.Router();

// Levels (for dropdown) — accessible to ADMIN_AGENCY+ too, but data is harmless
router.get('/levels', authenticateJwt, async (req, res, next) => {
  try {
    const levels = await listLevels();
    return res.json({ levels });
  } catch (err) {
    return next(err);
  }
});

router.get(
  '/',
  authenticateJwt,
  requireSuperadmin,
  validatePagination,
  async (req, res, next) => {
    try {
      const result = await listAllUsers({
        search: req.query.search,
        agencyId: req.query.agency_id ? parseInt(req.query.agency_id, 10) : null,
        levelCode: req.query.level,
        page: req.query.page || 1,
        limit: req.query.limit || 50,
      });
      return res.json(result);
    } catch (err) {
      return next(err);
    }
  }
);

router.get('/:id', authenticateJwt, requireSuperadmin, validateId, async (req, res, next) => {
  try {
    const user = await getUserById(parseInt(req.params.id, 10));
    return res.json({ user });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

router.post(
  '/',
  authenticateJwt,
  requireSuperadmin,
  validateUserCreate,
  async (req, res, next) => {
    try {
      const user = await createUserGlobal(req.body);
      return res.status(201).json({ user });
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
  validateUserUpdate,
  async (req, res, next) => {
    try {
      const user = await updateUserGlobal(parseInt(req.params.id, 10), req.body);
      return res.json({ user });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      return next(err);
    }
  }
);

router.post(
  '/:id/password/reset',
  authenticateJwt,
  requireSuperadmin,
  validateId,
  validatePasswordReset,
  async (req, res, next) => {
    try {
      const { new_password, force_change = true } = req.body;
      await resetUserPassword(parseInt(req.params.id, 10), new_password, force_change);
      return res.json({ ok: true, must_change_password: !!force_change });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      return next(err);
    }
  }
);

router.post(
  '/:id/agency',
  authenticateJwt,
  requireSuperadmin,
  validateId,
  async (req, res, next) => {
    try {
      const agencyId = parseInt(req.body.agency_id, 10);
      if (!agencyId) return res.status(400).json({ error: 'agency_id required' });
      const result = await moveUserToAgency(parseInt(req.params.id, 10), agencyId);
      return res.json(result);
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
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
      const result = await disableUserGlobal(parseInt(req.params.id, 10));
      return res.json(result);
    } catch (err) {
      return next(err);
    }
  }
);

export default router;