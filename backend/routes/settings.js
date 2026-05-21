// routes/settings.js
// All settings endpoints for ADMIN_AGENCY + own-user preferences.

import express from 'express';
import { authenticateJwt } from '../middleware/auth-jwt.js';
import {
  requireAgencyAdmin,
  requireAgencyContext,
  canAccessAgency,
} from '../middleware/auth-role.js';
import {
  validateId,
  validateAgencySettings,
  validateUserCreate,
  validateUserUpdate,
  validatePasswordReset,
} from '../middleware/validation.js';
import {
  getAgencySettings,
  updateAgencySettings,
  listAgencyUsers,
  createAgencyUser,
  updateAgencyUser,
  disableAgencyUser,
  resetAgencyUserPassword,
  getMyPreferences,
  updateMyPreferences,
} from '../services/settings-service.js';

const router = express.Router();

// =====================================================================
// AGENCY SETTINGS — ADMIN_AGENCY+
// =====================================================================

/**
 * Resolve which agency the request operates on.
 * - ADMIN_AGENCY: always their own agency
 * - SUPERADMIN: may pass ?agency_id=N to target specific agency,
 *               otherwise defaults to their own (or 400 if no agency)
 */
function resolveAgencyId(req) {
  const queryId = req.query.agency_id ? parseInt(req.query.agency_id, 10) : null;
  if (queryId && req.user.level.code === 'SUPERADMIN') return queryId;
  if (req.user.agency?.id) return req.user.agency.id;
  return null;
}

router.get('/agency', authenticateJwt, requireAgencyAdmin, async (req, res, next) => {
  try {
    const agencyId = resolveAgencyId(req);
    if (!agencyId) return res.status(400).json({ error: 'Cannot resolve agency_id' });
    if (!canAccessAgency(req.user, agencyId)) {
      return res.status(403).json({ error: 'Forbidden — agency mismatch' });
    }
    const settings = await getAgencySettings(agencyId);
    return res.json({ agency: settings });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

router.patch(
  '/agency',
  authenticateJwt,
  requireAgencyAdmin,
  validateAgencySettings,
  async (req, res, next) => {
    try {
      const agencyId = resolveAgencyId(req);
      if (!agencyId) return res.status(400).json({ error: 'Cannot resolve agency_id' });
      if (!canAccessAgency(req.user, agencyId)) {
        return res.status(403).json({ error: 'Forbidden — agency mismatch' });
      }
      const updated = await updateAgencySettings(agencyId, req.body);
      return res.json({ agency: updated });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      return next(err);
    }
  }
);

// =====================================================================
// USERS IN AGENCY
// =====================================================================

router.get(
  '/agency/users',
  authenticateJwt,
  requireAgencyAdmin,
  async (req, res, next) => {
    try {
      const agencyId = resolveAgencyId(req);
      if (!agencyId) return res.status(400).json({ error: 'Cannot resolve agency_id' });
      if (!canAccessAgency(req.user, agencyId)) {
        return res.status(403).json({ error: 'Forbidden — agency mismatch' });
      }
      const users = await listAgencyUsers(agencyId);
      return res.json({ users });
    } catch (err) {
      return next(err);
    }
  }
);

router.post(
  '/agency/users',
  authenticateJwt,
  requireAgencyAdmin,
  validateUserCreate,
  async (req, res, next) => {
    try {
      const agencyId = resolveAgencyId(req);
      if (!agencyId) return res.status(400).json({ error: 'Cannot resolve agency_id' });
      if (!canAccessAgency(req.user, agencyId)) {
        return res.status(403).json({ error: 'Forbidden — agency mismatch' });
      }
      const user = await createAgencyUser(agencyId, req.body, req.user.level.code);
      return res.status(201).json({ user });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      return next(err);
    }
  }
);

router.patch(
  '/agency/users/:id',
  authenticateJwt,
  requireAgencyAdmin,
  validateId,
  validateUserUpdate,
  async (req, res, next) => {
    try {
      const agencyId = resolveAgencyId(req);
      if (!agencyId) return res.status(400).json({ error: 'Cannot resolve agency_id' });
      if (!canAccessAgency(req.user, agencyId)) {
        return res.status(403).json({ error: 'Forbidden — agency mismatch' });
      }
      const userId = parseInt(req.params.id, 10);
      const updated = await updateAgencyUser(agencyId, userId, req.body, req.user);
      return res.json({ user: updated });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      return next(err);
    }
  }
);

router.delete(
  '/agency/users/:id',
  authenticateJwt,
  requireAgencyAdmin,
  validateId,
  async (req, res, next) => {
    try {
      const agencyId = resolveAgencyId(req);
      if (!agencyId) return res.status(400).json({ error: 'Cannot resolve agency_id' });
      if (!canAccessAgency(req.user, agencyId)) {
        return res.status(403).json({ error: 'Forbidden — agency mismatch' });
      }
      const userId = parseInt(req.params.id, 10);
      const result = await disableAgencyUser(agencyId, userId, req.user);
      return res.json(result);
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      return next(err);
    }
  }
);

router.post(
  '/agency/users/:id/password/reset',
  authenticateJwt,
  requireAgencyAdmin,
  validateId,
  validatePasswordReset,
  async (req, res, next) => {
    try {
      const agencyId = resolveAgencyId(req);
      if (!agencyId) return res.status(400).json({ error: 'Cannot resolve agency_id' });
      if (!canAccessAgency(req.user, agencyId)) {
        return res.status(403).json({ error: 'Forbidden — agency mismatch' });
      }
      const userId = parseInt(req.params.id, 10);
      const { new_password } = req.body;
      const result = await resetAgencyUserPassword(agencyId, userId, new_password, req.user);
      return res.json(result);
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      return next(err);
    }
  }
);

// =====================================================================
// USER UI PREFERENCES — any logged-in user
// =====================================================================

router.get('/me', authenticateJwt, async (req, res, next) => {
  try {
    const prefs = await getMyPreferences(req.user.id);
    return res.json({ preferences: prefs });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

router.patch('/me', authenticateJwt, async (req, res, next) => {
  try {
    const updated = await updateMyPreferences(req.user.id, req.body);
    return res.json({ preferences: updated });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

export default router;