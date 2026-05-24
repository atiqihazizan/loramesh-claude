// src/lib/baseUrl.js
// Rantaian: frontend/.env VITE_APP_BASE → vite.config `base` → import.meta.env.BASE_URL.
// Helper di sini — jangan hardcode '/v2/'.

/** @type {string} */
export const BASE_URL = import.meta.env.BASE_URL;

/** React Router basename — '/v2' atau undefined untuk root. */
export const routerBasename = BASE_URL.replace(/\/$/, '') || undefined;

/** Fail dalam frontend/public — ikut base Vite (bukan hardcode /v2/). */
export function publicAsset(filename) {
  const name = String(filename).replace(/^\//, '');
  return `${BASE_URL}${name}`;
}

/** Path login untuk redirect penuh (contoh '/v2/login' atau '/login'). */
export function loginPath() {
  return publicAsset('login').replace(/\/{2,}/g, '/');
}

/** REST API base path — elak clash v1 `/api` vs v2 `/v2/api` pada domain sama. */
export function apiBasePath() {
  const trimmed = BASE_URL.replace(/\/+$/, '');
  if (!trimmed) return '/api';
  return `${trimmed}/api`.replace(/\/{2,}/g, '/');
}

/** Socket.IO path (bukan URL penuh) — selari dengan nginx `location /v2/socket.io/`. */
export function socketIoPath() {
  const trimmed = BASE_URL.replace(/\/+$/, '');
  if (!trimmed) return '/socket.io';
  return `${trimmed}/socket.io`.replace(/\/{2,}/g, '/');
}
