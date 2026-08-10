// routes/boundaries.js

import express from 'express';
import multer from 'multer';
import { authenticateJwt } from '../middleware/auth-jwt.js';
import { requireAgencyAdmin } from '../middleware/auth-role.js';
import { validateId } from '../middleware/validation.js';
import {
  listBoundaries,
  getBoundaryById,
  createBoundary,
  updateBoundary,
  deleteBoundary,
  uploadBoundaries,
} from '../services/boundary-service.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ok =
      file.mimetype === 'application/json' ||
      file.mimetype === 'application/geo+json' ||
      /\.(json|geojson)$/i.test(file.originalname);
    cb(ok ? null : new Error('Fail mesti .json atau .geojson'), ok);
  },
});

function parseUploadPayload(req) {
  if (req.file) {
    let geojson;
    try {
      geojson = JSON.parse(req.file.buffer.toString('utf8'));
    } catch {
      const err = new Error('Fail GeoJSON tidak sah (JSON rosak)');
      err.status = 400;
      throw err;
    }
    const payload = { geojson };
    if (req.body.name_prefix) payload.name_prefix = req.body.name_prefix;
    if (req.body.agency_id) payload.agency_id = parseInt(req.body.agency_id, 10);
    if (req.body.visible !== undefined) {
      payload.visible = req.body.visible === true || req.body.visible === 'true';
    }
    return payload;
  }
  if (req.body?.geojson) return req.body;
  const err = new Error('Hantar fail GeoJSON (field: file) atau body.geojson');
  err.status = 400;
  throw err;
}

router.get('/', authenticateJwt, async (req, res, next) => {
  try {
    const fc = await listBoundaries(
      req.user,
      req.query.agency_id ? parseInt(req.query.agency_id, 10) : null
    );
    return res.json(fc);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

router.get('/:id', authenticateJwt, validateId, async (req, res, next) => {
  try {
    const feature = await getBoundaryById(parseInt(req.params.id, 10), req.user);
    return res.json(feature);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

router.post('/', authenticateJwt, requireAgencyAdmin, async (req, res, next) => {
  try {
    const feature = await createBoundary(req.body, req.user);
    return res.status(201).json(feature);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

router.post(
  '/upload',
  authenticateJwt,
  requireAgencyAdmin,
  upload.single('file'),
  async (req, res, next) => {
    try {
      const payload = parseUploadPayload(req);
      const result = await uploadBoundaries(payload, req.user);
      return res.status(201).json(result);
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      return next(err);
    }
  }
);

router.patch('/:id', authenticateJwt, requireAgencyAdmin, validateId, async (req, res, next) => {
  try {
    const feature = await updateBoundary(parseInt(req.params.id, 10), req.body, req.user);
    return res.json(feature);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

router.delete('/:id', authenticateJwt, requireAgencyAdmin, validateId, async (req, res, next) => {
  try {
    const result = await deleteBoundary(parseInt(req.params.id, 10), req.user);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

export default router;
