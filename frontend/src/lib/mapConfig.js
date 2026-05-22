// src/lib/mapConfig.js
// ----------------------------------------------------------------
// Fungsi tulen (tiada React) untuk uruskan config peta.
//   - Parse string "lat,lng" → [lng, lat] (MapLibre guna lng dahulu)
//   - Kesan tile raster vs style JSON dari corak URL
//   - Padan default_tile_provider legacy ke baris tiles
// ----------------------------------------------------------------

import { findTileByBasemapName } from './basemapLabels.js';
// Fallback center — Kuala Lumpur. Order [lng, lat] (MapLibre).
export const FALLBACK_CENTER = [101.6869, 3.139];
export const FALLBACK_ZOOM = 13;

/**
 * Parse string "lat,lng" dari backend → [lng, lat] untuk MapLibre.
 *
 * Backend simpan "3.1390,101.6869" (lat dahulu, ikut konvensyen GPS).
 * MapLibre mahu [lng, lat]. Fungsi ini tukar susunan + sahkan julat.
 *
 * @param {string|null|undefined} str
 * @returns {[number, number]|null}  [lng, lat] atau null jika tak sah
 */
export function parseLatLng(str) {
  if (!str || typeof str !== 'string') return null;

  const parts = str.split(',').map((s) => Number(s.trim()));
  if (parts.length !== 2) return null;

  const [lat, lng] = parts;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  // Sahkan julat koordinat bumi.
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;

  return [lng, lat]; // tukar ke susunan MapLibre
}

/**
 * Kesan sama ada URL tile ialah raster XYZ atau style JSON MapLibre.
 *
 * Raster XYZ ada placeholder {z}/{x}/{y} (cth Esri).
 * Style JSON tiada placeholder (cth OpenFreeMap .../styles/liberty).
 *
 * @param {string} url
 * @returns {boolean}  true = raster XYZ, false = style JSON
 */
export function isRasterTile(url) {
  if (!url || typeof url !== 'string') return false;
  return url.includes('{z}');
}

/**
 * Padan default_tile_provider legacy (string bebas) ke nama baris tiles.
 *
 * DB legacy simpan nilai macam "osm" yang tak padan terus dengan
 * nama tiles ("Roadmap"/"Satelit"/"Terrain"). Padanan longgar:
 *   osm | roadmap | road | (kosong)  → Roadmap
 *   satelit | satellite | sat        → Satellite (legacy DB: Satelit)
 *   terrain | topo                   → Terrain
 *   selainnya                        → Roadmap (lalai selamat)
 *
 * @param {string|null|undefined} provider  nilai default_tile_provider
 * @param {Array<{name:string}>} tiles      senarai tiles dari /api/tiles
 * @returns {object|null}  baris tile terpilih, atau null jika tiles kosong
 */
export function matchTileProvider(provider, tiles) {
  if (!Array.isArray(tiles) || tiles.length === 0) return null;

  const key = (provider || '').toLowerCase().trim();

  let wanted = 'Roadmap';
  if (['satelit', 'satellite', 'sat'].includes(key)) wanted = 'Satellite';
  else if (['terrain', 'topo'].includes(key)) wanted = 'Terrain';

  return findTileByBasemapName(tiles, wanted);
}