// routes/auth.js
// HTTP wiring only — all logic in services/auth-service.js

import express from 'express';
import { authLimiter, passwordChangeLimiter } from '../middleware/rate-limit.js';
import { authenticateJwt } from '../middleware/auth-jwt.js';
import {
  validateLogin,
  validatePasswordChange,
} from '../middleware/validation.js';
import {
  loginWithCredentials,
  logoutUser,
  getCurrentUser,
  changeOwnPassword,
  getSessionConfigForAgency,
} from '../services/auth-service.js';

const router = express.Router();

// --------------------------------------------
// POST /api/auth/login
// --------------------------------------------
router.post('/login', authLimiter, validateLogin, async (req, res, next) => {
  try {
    const { username, password, device_type } = req.body;
    const result = await loginWithCredentials({
      username,
      password,
      deviceType: device_type,
      ipAddress: req.ip,
    });
    return res.json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    return next(err);
  }
});

// --------------------------------------------
// POST /api/auth/logout
// --------------------------------------------
router.post('/logout', authenticateJwt, async (req, res, next) => {
  try {
    await logoutUser(req.user.id);
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

// --------------------------------------------
// GET /api/auth/me
// --------------------------------------------
router.get('/me', authenticateJwt, async (req, res, next) => {
  try {
    const user = await getCurrentUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user });
  } catch (err) {
    return next(err);
  }
});

// --------------------------------------------
// POST /api/auth/password — user changes own password
// --------------------------------------------
router.post(
  '/password',
  authenticateJwt,
  passwordChangeLimiter,
  validatePasswordChange,
  async (req, res, next) => {
    try {
      const { current_password, new_password } = req.body;
      await changeOwnPassword(req.user.id, current_password, new_password);
      return res.json({
        ok: true,
        message: 'Password changed successfully. Please log in again.',
      });
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ error: err.message, code: err.code });
      }
      return next(err);
    }
  }
);

// --------------------------------------------
// GET /api/auth/session-config?agency=CODE — public
// Frontend calls this on login page to show session TTL.
// --------------------------------------------
router.get('/session-config', async (req, res, next) => {
  try {
    const agencyCode = req.query.agency;
    const config = await getSessionConfigForAgency(agencyCode);
    if (!config) return res.status(404).json({ error: 'Agency not found or inactive' });
    return res.json(config);
  } catch (err) {
    return next(err);
  }
});

export default router;