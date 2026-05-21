// lib/prisma.js
// Single Prisma client instance for entire app.
// Singleton pattern — import this, don't `new PrismaClient()` elsewhere.

import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { env } from '../config/env.js';

const logLevels = env.IS_PRODUCTION
  ? ['error', 'warn']
  : ['error', 'warn'];  // Add 'query' here for SQL debug

const adapter = new PrismaMariaDb(env.DATABASE_URL);

export const prisma = new PrismaClient({
  adapter,
  log: logLevels,
});

let connected = false;

export async function connectPrisma() {
  if (connected) return;
  await prisma.$connect();
  connected = true;
  console.log('[prisma] ✓ Connected to database');
}

export async function disconnectPrisma() {
  if (!connected) return;
  await prisma.$disconnect();
  connected = false;
  console.log('[prisma] ✓ Disconnected');
}

export default prisma;
