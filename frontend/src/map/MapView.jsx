// src/map/MapView.jsx
// ----------------------------------------------------------------
// Komponen peta MapLibre penuh skrin (react-map-gl/maplibre).
//
// Putar/condong/pan SENTIASA hidup — tiada mod:
//   - pan      : seret kiri
//   - putar    : seret kanan (atau dua jari di mobile)
//   - condong  : seret kanan / dua jari
//   - maxPitch : 85°
//
// Baca center/zoom/activeTile dari MapContext.
// TIADA marker, TIADA terrain DEM lagi.
// ----------------------------------------------------------------

import { useMemo } from 'react';
import Map from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

import { buildMapStyle } from '../lib/mapStyle.js';
import { useMapContext } from './MapContext.jsx';
import MapControls from './MapControls.jsx';

export default function MapView() {
  const { center, zoom, activeTile } = useMapContext();

  // viewState awal sahaja — MapLibre uruskan selepas ini.
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

  // Tiada tile aktif lagi — tunggu.
  if (!mapStyle) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100">
        <p className="text-slate-500">Menyediakan peta…</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <Map
        initialViewState={initialViewState}
        mapStyle={mapStyle}
        // Putar + condong sentiasa boleh.
        maxPitch={85}
        dragRotate
        pitchWithRotate
        touchZoomRotate
        attributionControl={{ compact: true }}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Kawalan zoom — sudut kanan bawah */}
        <MapControls />
      </Map>
    </div>
  );
}