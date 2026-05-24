// src/lib/socket.js
// ----------------------------------------------------------------
// Single Socket.IO client connection (E2-markers-b).
//
// The backend Socket.IO server runs on the same host/port as the
// HTTP API. It authenticates via handshake auth token (the JWT
// stored in localStorage, same token as the REST api client).
//
// One shared socket instance for the whole app. Connect lazily —
// created on first getSocket() call, reused after.
// ----------------------------------------------------------------

import { io } from 'socket.io-client';
import { socketIoPath } from './baseUrl.js';

function resolveSocketConfig() {
  if (import.meta.env.VITE_SOCKET_URL != null && import.meta.env.VITE_SOCKET_URL !== '') {
    return {
      url: import.meta.env.VITE_SOCKET_URL.replace(/\/+$/, ''),
      path: '/socket.io',
    };
  }
  if (import.meta.env.PROD) {
    return { url: undefined, path: socketIoPath() };
  }
  return { url: 'http://localhost:5002', path: '/socket.io' };
}

const SOCKET_CONFIG = resolveSocketConfig();

let socket = null;

// Read the JWT the same way the REST api client does.
function readToken() {
  try {
    // Zustand persist store shape: { state: { token } }
    const raw = localStorage.getItem('auth-storage');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.state?.token) return parsed.state.token;
    }
  } catch {
    // ignore — fall through
  }
  // Fallback: plain token key.
  return localStorage.getItem('token') || null;
}

/**
 * Get the shared socket instance. Created on first call.
 * Not connected automatically — call connectSocket() to connect.
 */
export function getSocket() {
  if (socket) return socket;

  socket = io(SOCKET_CONFIG.url, {
    autoConnect: false,
    transports: ['websocket'],
    path: SOCKET_CONFIG.path,
    auth: { token: readToken() },
  });

  return socket;
}

/**
 * Connect the socket if not already connected.
 * Refreshes the auth token before connecting (it may have changed).
 */
export function connectSocket() {
  const s = getSocket();
  if (s.connected) return s;
  // Refresh token in case it changed since socket creation.
  s.auth = { token: readToken() };
  s.connect();
  return s;
}

/**
 * Disconnect the shared socket (e.g. on logout).
 */
export function disconnectSocket() {
  if (socket && socket.connected) {
    socket.disconnect();
  }
}
