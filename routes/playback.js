// routes/playback.js
import express from 'express';
import { authenticateJwt } from '../middleware/auth-jwt.js';
import { getBounds, getTrack, getSummary } from '../services/playback-service.js';

const router = express.Router();

router.get('/:deviceId/bounds', authenticateJwt, async (req, res, next) => {
  try {
    const result = await getBounds(req.params.deviceId, req.user);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

// GET /api/playback/:deviceId?from=&to=&limit=&resolution=full|auto
router.get('/:deviceId', authenticateJwt, async (req, res, next) => {
  try {
    const { from, to, limit, resolution } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to query params required' });
    }
    const result = await getTrack(req.params.deviceId, req.user, {
      from, to,
      limit: limit ? parseInt(limit, 10) : 50000,
      resolution: resolution === 'auto' ? 'auto' : 'full',
    });
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

router.get('/:deviceId/summary', authenticateJwt, async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to query params required' });
    }
    const result = await getSummary(req.params.deviceId, req.user, { from, to });
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

export default router;
