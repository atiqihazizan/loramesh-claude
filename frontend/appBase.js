// frontend/appBase.js
// Satu titik tetap untuk path UI (Vite `base`). Vite config baca fail ini + .env VITE_APP_BASE.

/** Nilai default jika VITE_APP_BASE tidak diset dalam .env */
export const DEFAULT_APP_BASE = '/v2/';

/** @param {string | undefined} raw */
export function normalizeAppBase(raw) {
  if (raw == null || raw === '' || raw === '/') return '/';
  const s = String(raw).trim();
  if (s === '/') return '/';
  const withLeading = s.startsWith('/') ? s : `/${s}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}
