// routes/nodes.js
// REST ingest endpoint — alternatif kepada MQTT untuk hantar tracking data.
// Berguna untuk testing tanpa broker, atau gateway yang guna HTTP.
// Auth: agency token (sama macam Flutter).

import express from 'express';
import { authenticateAgencyToken } from '../middleware/auth-agency-token.js';
import { ingestSingle, ingestBatch, getLiveSnapshot } from '../services/tracking-service.js';

const router = express.Router();

// --------------------------------------------
// POST /api/nodes/ingest — hantar satu tracking payload
// --------------------------------------------
router.post('/ingest', authenticateAgencyToken, async (req, res, next) => {
  try {
    const result = await ingestSingle(req.body);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

// --------------------------------------------
// POST /api/nodes/ingest/batch — backfill
// --------------------------------------------
router.post('/ingest/batch', authenticateAgencyToken, async (req, res, next) => {
  try {
    const items = Array.isArray(req.body) ? req.body : req.body.items;
    const result = await ingestBatch(items);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

// --------------------------------------------
// GET /api/nodes/live — snapshot semua device dalam agency
// --------------------------------------------
router.get('/live', authenticateAgencyToken, async (req, res, next) => {
  try {
    const devices = await getLiveSnapshot(req.agency.id);
    return res.json({ devices });
  } catch (err) {
    return next(err);
  }
});

export default router;
