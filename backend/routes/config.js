// routes/config.js
// Global system config — fallback bila agency takda setting sendiri.

import express from 'express';
import { authenticateJwt } from '../middleware/auth-jwt.js';
import { requireSuperadmin } from '../middleware/auth-role.js';
import prisma from '../lib/prisma.js';

const router = express.Router();

router.get('/', authenticateJwt, async (req, res, next) => {
  try {
    const config = await prisma.config.findFirst();
    return res.json({ config });
  } catch (err) {
    return next(err);
  }
});

router.patch('/', authenticateJwt, requireSuperadmin, async (req, res, next) => {
  try {
    let config = await prisma.config.findFirst();
    const allowed = {};
    if (req.body.name !== undefined) allowed.name = req.body.name;
    if (req.body.latlng !== undefined) allowed.latlng = req.body.latlng;
    if (req.body.zoom !== undefined) allowed.zoom = req.body.zoom;

    if (config) {
      config = await prisma.config.update({ where: { id: config.id }, data: allowed });
    } else {
      config = await prisma.config.create({ data: allowed });
    }
    return res.json({ config });
  } catch (err) {
    return next(err);
  }
});

export default router;
