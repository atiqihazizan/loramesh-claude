// src/lib/mapStyle.js
// ----------------------------------------------------------------
// Bina "mapStyle" untuk react-map-gl <Map> dari satu baris tile.
//
//   - Tile vektor (OpenFreeMap)  → pulangkan URL style JSON terus.
//       MapLibre muat sendiri; dapat label, bangunan, dll.
//   - Tile raster (Esri XYZ)     → bina objek style JSON minimum
//       dengan satu raster source + satu raster layer.
//
// Pengesanan jenis guna isRasterTile() dari mapConfig.js.
// ----------------------------------------------------------------

import { isRasterTile } from './mapConfig.js';

/**
 * Bina style JSON minimum untuk satu sumber tile raster XYZ.
 *
 * @param {string} url   URL template XYZ, cth ".../tile/{z}/{y}/{x}"
 * @param {string} name  nama tile (untuk attribution / id rujukan)
 * @returns {object}     objek style MapLibre
 */
function buildRasterStyle(url, name) {
  return {
    version: 8,
    // glyphs perlu walau tiada label — elak ralat bila layer lain
    // (cth 3D buildings nanti) ditambah atas style ini.
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      'raster-source': {
        type: 'raster',
        tiles: [url],
        tileSize: 256,
        // Esri World Imagery sokong hingga ~z19 di kebanyakan kawasan.
        maxzoom: 19,
        attribution:
          name === 'Satelit' || name === 'Satellite'
            ? 'Imagery © Esri, Maxar, Earthstar Geographics'
            : '© ' + name,
      },
    },
    layers: [
      {
        id: 'raster-layer',
        type: 'raster',
        source: 'raster-source',
      },
    ],
  };
}

/**
 * Tukar satu baris tile (dari /api/tiles) kepada "mapStyle" yang
 * boleh terus dihantar ke prop `mapStyle` <Map> react-map-gl.
 *
 * @param {{name:string, url:string, theme:string}|null} tile
 * @returns {string|object|null}
 *   - string  : URL style JSON (tile vektor)
 *   - object  : objek style JSON (tile raster)
 *   - null    : tile tiada / tak sah
 */
export function buildMapStyle(tile) {
  if (!tile || !tile.url) return null;

  if (isRasterTile(tile.url)) {
    return buildRasterStyle(tile.url, tile.name);
  }

  // Tile vektor — OpenFreeMap sediakan style JSON lengkap di URL ini.
  return tile.url;
}