// config/cors.js
import cors from 'cors';
import { env } from './env.js';

const origins = env.CORS_ORIGINS;

/**
 * Express CORS middleware
 * - Permissive in development (log warning, still allow)
 * - Strict in production (reject unknown origins)
 */
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow no-origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (origins.includes(origin)) return callback(null, true);

    if (!env.IS_PRODUCTION) {
      console.warn(`[cors] ⚠️ Origin not whitelisted (dev: allowed): ${origin}`);
      return callback(null, true);
    }
    console.warn(`[cors] ❌ Origin rejected: ${origin}`);
    return callback(new Error(`Origin not allowed: ${origin}`), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-agency-token',
    'x-request-id',
  ],
});

/**
 * Socket.IO CORS config (used in realtime/socket-server.js)
 */
export const socketCorsConfig = {
  origin: origins,
  credentials: true,
};