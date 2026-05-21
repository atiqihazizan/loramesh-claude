// server.js
// Backend entry point — Phase A minimal (no Socket.IO/MQTT yet).
// Bootstrap order: env → prisma → cache → routes → listen.

import express from 'express';
import compression from 'compression';
import helmet from 'helmet';

import { env } from './config/env.js';
import { corsMiddleware } from './config/cors.js';
import { connectPrisma, disconnectPrisma } from './lib/prisma.js';
import { initAllCaches } from './lib/cache/index.js';
import { loadKnownPlaybackTables } from './lib/playback.js';

import { requestLogger } from './middleware/audit.js';
import { generalLimiter } from './middleware/rate-limit.js';
import { tryAuthenticateJwt } from './middleware/auth-jwt.js';
import { enforcePasswordChange } from './middleware/must-change-password.js';
import { notFoundHandler, errorHandler } from './middleware/error-handler.js';

import apiRoutes from './routes/index.js';

const app = express();

// ============================================
// MIDDLEWARE PIPELINE
// ============================================

// Trust proxy (kalau di belakang Nginx/CloudFlare)
app.set('trust proxy', 1);

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: false, // disable CSP for now (boleh tighten kemudian)
  })
);

// CORS
app.use(corsMiddleware);

// Request logger (mount EARLY)
app.use(requestLogger);

// Compression
app.use(compression());

// Body parsers
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Rate limit semua /api/*
app.use('/api', generalLimiter);

// Optional auth — populate req.user kalau ada token (untuk audit log + must-change-password check)
app.use('/api', tryAuthenticateJwt);
app.use('/api', enforcePasswordChange);

// ============================================
// ROUTES
// ============================================
app.use('/api', apiRoutes);

// Root
app.get('/', (req, res) => {
  res.json({
    name: 'LoRa Backend (claude)',
    version: '3.0.0',
    status: 'ok',
    docs: '/api/health/ping',
  });
});

// 404 + error handler (LAST)
app.use(notFoundHandler);
app.use(errorHandler);

// ============================================
// BOOTSTRAP
// ============================================

async function bootstrap() {
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('  LoRa Backend (claude) — Phase A');
  console.log('═══════════════════════════════════════════════');
  console.log('');

  try {
    // 1. Connect Prisma
    await connectPrisma();

    // 2. Load caches
    await initAllCaches();

    // 3. Discover existing playback tables
    await loadKnownPlaybackTables();

    // 4. Start HTTP server
    const server = app.listen(env.PORT, () => {
      console.log('');
      console.log(`[server] ✓ Listening on port ${env.PORT}`);
      console.log(`[server] ✓ http://localhost:${env.PORT}/api/health/ping`);
      console.log('');
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`\n[server] Received ${signal}, shutting down gracefully...`);
      server.close(async () => {
        await disconnectPrisma();
        console.log('[server] ✓ Shutdown complete');
        process.exit(0);
      });

      // Force-exit if graceful shutdown takes >10s
      setTimeout(() => {
        console.error('[server] ⚠️  Forced shutdown after 10s');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle unhandled errors
    process.on('unhandledRejection', (reason, promise) => {
      console.error('[server] Unhandled Rejection:', reason);
    });
    process.on('uncaughtException', (err) => {
      console.error('[server] Uncaught Exception:', err);
      process.exit(1);
    });
  } catch (err) {
    console.error('[server] ❌ Bootstrap failed:', err);
    process.exit(1);
  }
}

bootstrap();