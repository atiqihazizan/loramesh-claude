// server.js
// Backend entry point — Phase C: HTTP + Socket.IO + MQTT.

import http from 'node:http';
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

import { initSocketServer } from './realtime/socket-server.js';
import { initMqttClient, disconnectMqtt, isMqttConnected } from './realtime/mqtt-client.js';

const app = express();

// ============================================
// MIDDLEWARE
// ============================================
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(corsMiddleware);
app.use(requestLogger);
app.use(compression());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use('/api', generalLimiter);
app.use('/api', tryAuthenticateJwt);
app.use('/api', enforcePasswordChange);

// ============================================
// ROUTES
// ============================================
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.json({
    name: 'LoRa Backend (claude)',
    version: '3.0.0',
    status: 'ok',
    mqtt: isMqttConnected() ? 'connected' : 'disconnected',
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

// ============================================
// BOOTSTRAP
// ============================================
async function bootstrap() {
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('  LoRa Backend (claude) — Phase C');
  console.log('═══════════════════════════════════════════════');
  console.log('');

  try {
    // 1. Prisma
    await connectPrisma();

    // 2. Caches
    await initAllCaches();

    // 3. Playback tables
    await loadKnownPlaybackTables();

    // 4. HTTP server (eksplisit — perlu untuk Socket.IO)
    const httpServer = http.createServer(app);

    // 5. Socket.IO
    initSocketServer(httpServer);

    // 6. MQTT (kalau enabled)
    initMqttClient();

    // 7. Listen
    httpServer.listen(env.PORT, () => {
      console.log('');
      console.log(`[server] ✓ HTTP + Socket.IO listening on port ${env.PORT}`);
      console.log(`[server] ✓ http://localhost:${env.PORT}/api/health/ping`);
      console.log('');
    });

    // --- Graceful shutdown ---
    const shutdown = async (signal) => {
      console.log(`\n[server] ${signal} — shutting down...`);
      httpServer.close(async () => {
        await disconnectMqtt();
        await disconnectPrisma();
        console.log('[server] ✓ Shutdown complete');
        process.exit(0);
      });
      setTimeout(() => {
        console.error('[server] ⚠️ Forced shutdown');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('unhandledRejection', (reason) => {
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
