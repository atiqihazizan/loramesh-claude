// routes/notifications.js

import express from 'express';
import { authenticateJwt } from '../middleware/auth-jwt.js';
import { validateId } from '../middleware/validation.js';
import {
  listNotifications,
  markRead,
  markAllRead,
} from '../services/notification-service.js';

const router = express.Router();

router.get('/', authenticateJwt, async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 30;
    const result = await listNotifications(req.user.id, { limit });
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

router.patch('/read-all', authenticateJwt, async (req, res, next) => {
  try {
    const result = await markAllRead(req.user.id);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

router.patch('/:id/read', authenticateJwt, validateId, async (req, res, next) => {
  try {
    const notif = await markRead(parseInt(req.params.id, 10), req.user.id);
    return res.json({ notification: notif });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

export default router;
