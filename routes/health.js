// routes/health.js
// Simple health check + cache stats. No auth required for /ping (load balancer
// friendly); /stats requires SUPERADMIN.

import express from 'express';
import { authenticateJwt } from '../middleware/auth-jwt.js';
import { requireSuperadmin } from '../middleware/auth-role.js';
import { getAllCacheStats } from '../lib/cache/index.js';
import { getKnownTableCount } from '../lib/playback.js';
import prisma from '../lib/prisma.js';

const router = express.Router();

router.get('/ping', (req, res) => {
  return res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

router.get('/stats', authenticateJwt, requireSuperadmin, async (req, res, next) => {
  try {
    // Quick DB ping
    let dbOk = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch (e) {
      dbOk = false;
    }

    return res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      memory: process.memoryUsage(),
      db: { ok: dbOk },
      caches: getAllCacheStats(),
      playback_tables: getKnownTableCount(),
    });
  } catch (err) {
    return next(err);
  }
});

export default router;