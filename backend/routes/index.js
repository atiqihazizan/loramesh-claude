// routes/index.js
import express from 'express';
import authRoutes        from './auth.js';
import settingsRoutes    from './settings.js';
import usersRoutes       from './users.js';
import agenciesRoutes    from './agencies.js';
import deviceTypesRoutes from './device-types.js';
import sensorsRoutes     from './sensors.js';
import healthRoutes      from './health.js';    // ← NEW

const router = express.Router();

router.use('/auth',         authRoutes);
router.use('/settings',     settingsRoutes);
router.use('/users',        usersRoutes);
router.use('/agencies',     agenciesRoutes);
router.use('/device-types', deviceTypesRoutes);
router.use('/sensors',      sensorsRoutes);
router.use('/health',       healthRoutes);      // ← NEW

export default router;
