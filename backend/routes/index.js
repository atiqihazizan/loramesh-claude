// routes/index.js
import express from 'express';
import authRoutes        from './auth.js';
import settingsRoutes    from './settings.js';
import usersRoutes       from './users.js';
import agenciesRoutes    from './agencies.js';
import deviceTypesRoutes from './device-types.js';
import sensorsRoutes     from './sensors.js';
import healthRoutes      from './health.js';
import devicesRoutes     from './devices.js';
import sitesRoutes       from './sites.js';
import boundariesRoutes  from './boundaries.js';
import nodesRoutes       from './nodes.js';
import playbackRoutes    from './playback.js';
import tilesRoutes       from './tiles.js';
import configRoutes      from './config.js';
import notificationsRoutes from './notifications.js';
import devicesUserRoutes from './devices-user.js';
import provisionRoutes from './provision.js';

const router = express.Router();

router.use('/auth',         authRoutes);
router.use('/settings',     settingsRoutes);
router.use('/users',        usersRoutes);
router.use('/agencies',     agenciesRoutes);
router.use('/device-types', deviceTypesRoutes);
router.use('/sensors',      sensorsRoutes);
router.use('/health',       healthRoutes);
router.use('/devices',      devicesRoutes);
router.use('/sites',        sitesRoutes);
router.use('/boundaries',   boundariesRoutes);
router.use('/nodes',        nodesRoutes);
router.use('/playback',     playbackRoutes);
router.use('/tiles',        tilesRoutes);
router.use('/config',       configRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/devices-user', devicesUserRoutes);
router.use('/provision',    provisionRoutes);

export default router;
