// middleware/error-handler.js
// Global error handler + 404 handler. Mount LAST in server.js (after all routes).

import { env } from '../config/env.js';

// Common Prisma error codes → HTTP mapping
const PRISMA_ERROR_MAP = {
  P2002: { status: 409, message: 'Duplicate value violates unique constraint' },
  P2003: { status: 400, message: 'Foreign key constraint failed' },
  P2025: { status: 404, message: 'Record not found' },
};

/**
 * 404 handler — mount AFTER all routes, BEFORE errorHandler.
 */
export function notFoundHandler(req, res) {
  return res.status(404).json({
    error: 'Not found',
    path: req.originalUrl,
    method: req.method,
  });
}

/**
 * Global error handler — must have 4 args for Express to recognize it.
 */
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  // CORS rejection
  if (err.message?.startsWith('Origin not allowed')) {
    return res.status(403).json({ error: err.message });
  }

  // Prisma known errors
  if (err.code && PRISMA_ERROR_MAP[err.code]) {
    const mapped = PRISMA_ERROR_MAP[err.code];
    return res.status(mapped.status).json({
      error: mapped.message,
      code: err.code,
      ...(env.IS_PRODUCTION ? {} : { detail: err.meta }),
    });
  }

  // JSON parse errors (from body-parser)
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  // Multer upload errors
  if (err.name === 'MulterError') {
    return res.status(400).json({ error: `Upload failed: ${err.message}` });
  }

  // Default 500
  console.error(`[error-handler] ${req.method} ${req.originalUrl}`);
  console.error(err);
  return res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(env.IS_PRODUCTION ? {} : { stack: err.stack }),
  });
}