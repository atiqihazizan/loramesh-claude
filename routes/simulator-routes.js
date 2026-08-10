// routes/simulator-routes.js

import express from 'express';
import { authenticateJwt } from '../middleware/auth-jwt.js';
import {
  listSimulatorRoutes,
  getSimulatorRoute,
  saveSimulatorRoute,
  deleteSimulatorRoute,
} from '../services/simulator-route-service.js';

const router = express.Router();

router.get('/', authenticateJwt, async (req, res, next) => {
  try {
    const routes = await listSimulatorRoutes();
    return res.json({ routes });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

router.get('/:device_id', authenticateJwt, async (req, res, next) => {
  try {
    const route = await getSimulatorRoute(req.params.device_id);
    return res.json(route);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

router.put('/:device_id', authenticateJwt, async (req, res, next) => {
  try {
    const route = await saveSimulatorRoute(req.params.device_id, req.body.route);
    return res.json(route);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

router.delete('/:device_id', authenticateJwt, async (req, res, next) => {
  try {
    const result = await deleteSimulatorRoute(req.params.device_id);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

export default router;
