// realtime/socket-server.js
// Socket.IO server — frontend connect sini untuk live updates.
// Auth guna JWT (sama dengan REST). Setiap agency = satu room.

import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { socketCorsConfig } from '../config/cors.js';
import prisma from '../lib/prisma.js';
import { setSocketIO } from './tracking-pipeline.js';
import { registerSocketHandlers } from './socket-handlers.js';

let io = null;

/**
 * Init Socket.IO atas HTTP server sedia ada.
 * @param {http.Server} httpServer
 */
export function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: socketCorsConfig,
    pingTimeout: 30000,
    pingInterval: 25000,
  });

  // --- AUTH middleware ---
  // Token boleh datang dari handshake.auth.token atau query.token
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token;

      if (!token) {
        return next(new Error('No token provided'));
      }

      const payload = jwt.verify(token, env.JWT_SECRET);
      const user = await prisma.users.findUnique({
        where: { id: payload.id },
        include: {
          level: true,
          user_agencies: { include: { agency: true }, take: 1 },
        },
      });

      if (!user) return next(new Error('User not found'));
      if (user.status === 'banned' || user.status === 'disabled') {
        return next(new Error('Account disabled'));
      }

      const agencyLink = user.user_agencies[0];
      socket.data.user = {
        id: user.id,
        username: user.username,
        level: user.level.code,
        agency: agencyLink?.agency
          ? { id: agencyLink.agency.id, code: agencyLink.agency.code }
          : null,
      };
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  // --- Connection handler ---
  io.on('connection', (socket) => {
    const user = socket.data.user;
    console.log(`[socket] ✓ Connected: ${user.username} (${socket.id})`);

    // Auto-join agency room
    if (user.agency?.id) {
      socket.join(`agency:${user.agency.id}`);
      console.log(`[socket]   joined room agency:${user.agency.id}`);
    }

    // SUPERADMIN boleh join semua agency (kalau perlu) — handled dalam handlers

    registerSocketHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      console.log(`[socket] ✗ Disconnected: ${user.username} (${reason})`);
    });
  });

  // Bagi pipeline akses ke io untuk broadcast
  setSocketIO(io);

  console.log('[socket] ✓ Socket.IO server initialized');
  return io;
}

export function getIO() {
  return io;
}
