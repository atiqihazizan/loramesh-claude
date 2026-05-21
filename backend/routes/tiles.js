// routes/tiles.js
// Map tile providers — frontend layer switcher. Read untuk semua user.

import express from 'express';
import { authenticateJwt } from '../middleware/auth-jwt.js';
import { requireSuperadmin } from '../middleware/auth-role.js';
import { validateId } from '../middleware/validation.js';
import prisma from '../lib/prisma.js';

const router = express.Router();

router.get('/', authenticateJwt, async (req, res, next) => {
  try {
    const tiles = await prisma.tiles.findMany({ orderBy: { id: 'asc' } });
    return res.json({ tiles });
  } catch (err) {
    return next(err);
  }
});

router.post('/', authenticateJwt, requireSuperadmin, async (req, res, next) => {
  try {
    const { name, icon, url, theme } = req.body;
    const tile = await prisma.tiles.create({
      data: { name, icon, url, theme: theme || 'light' },
    });
    return res.status(201).json({ tile });
  } catch (err) {
    return next(err);
  }
});

router.patch('/:id', authenticateJwt, requireSuperadmin, validateId, async (req, res, next) => {
  try {
    const allowed = {};
    for (const f of ['name', 'icon', 'url', 'theme']) {
      if (req.body[f] !== undefined) allowed[f] = req.body[f];
    }
    const tile = await prisma.tiles.update({
      where: { id: parseInt(req.params.id, 10) },
      data: allowed,
    });
    return res.json({ tile });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', authenticateJwt, requireSuperadmin, validateId, async (req, res, next) => {
  try {
    await prisma.tiles.delete({ where: { id: parseInt(req.params.id, 10) } });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

export default router;
