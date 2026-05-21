// src/map/MapView.jsx
// ----------------------------------------------------------------
// Komponen peta MapLibre penuh skrin (react-map-gl/maplibre).
//
// E2-core: peta + boleh condong/pusing + tukar basemap + kawalan.
// TIADA marker, TIADA terrain DEM lagi (itu E2-terrain / E2-markers).
//
// Nota peralihan basemap:
//   Tukar antara vektor ↔ raster bermakna objek `mapStyle` ditukar
//   penuh. Peta akan "kelip" sekejap — tingkah laku biasa untuk
//   pendekatan tukar-style-penuh. Boleh dioptimum kemudian.
// ----------------------------------------------------------------

import { useState, useCallback, useMemo } from 'react';
import Map from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

import { buildMapStyle } from '../lib/mapStyle.js';
import BasemapSwitcher from './BasemapSwitcher.jsx';
import MapControls from './MapControls.jsx';

/**
 * @param {object}   props
 * @param {[number,number]} props.center        [lng, lat] awal
 * @param {number}   props.zoom                 zoom awal
 * @param {Array}    props.tiles                senarai tiles /api/tiles
 * @param {object}   props.initialTile          baris tile awal
 */
export default function MapView({ center, zoom, tiles, initialTile }) {
  // Tile aktif — mula dengan initialTile, tukar via BasemapSwitcher.
  const [activeTile, setActiveTile] = useState(initialTile);

  // viewState awal sahaja — MapLibre uruskan selepas ini secara dalaman.
  const initialViewState = useMemo(
    () => ({
      longitude: center[0],
      latitude: center[1],
      zoom,
      pitch: 0,
      bearing: 0,
    }),
    [center, zoom],
  );

  // Bina style dari tile aktif.
  const mapStyle = useMemo(() => buildMapStyle(activeTile), [activeTile]);

  const handleTileChange = useCallback((tile) => {
    setActiveTile(tile);
  }, []);

  // Kalau tiada tile langsung — tiada style untuk dirender.
  if (!mapStyle) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100">
        <p className="text-slate-500">Tiada sumber peta tersedia.</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <Map
        initialViewState={initialViewState}
        mapStyle={mapStyle}
        // Kawalan 3D — condong + pusing.
        maxPitch={75}
        dragRotate
        pitchWithRotate
        // react-map-gl perlukan ini untuk MapLibre.
        attributionControl={{ compact: true }}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Kawalan zoom / compass / pitch — sudut kanan bawah */}
        <MapControls />
      </Map>

      {/* Penukar basemap — kad terapung kanan atas */}
      <BasemapSwitcher
        tiles={tiles}
        activeTile={activeTile}
        onChange={handleTileChange}
      />
    </div>
  );
}