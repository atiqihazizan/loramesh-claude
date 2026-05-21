// src/map/MapControls.jsx
// ----------------------------------------------------------------
// Kawalan peta — zoom in/out, compass (reset bearing), pitch.
//
// Guna NavigationControl terbina react-map-gl:
//   visualizePitch = true  → compass juga tunjuk pitch (kecondongan),
//   dan klik compass reset bearing + pitch ke 0.
//
// Diletak di dalam <Map> sebagai child — react-map-gl render ia
// sebagai kawalan peta sebenar (bukan overlay biasa).
// ----------------------------------------------------------------

import { NavigationControl, ScaleControl } from 'react-map-gl/maplibre';

export default function MapControls() {
  return (
    <>
      {/* Zoom + compass + pitch — sudut kanan bawah */}
      <NavigationControl
        position="bottom-right"
        showCompass
        showZoom
        visualizePitch
      />

      {/* Bar skala — sudut kiri bawah */}
      <ScaleControl position="bottom-left" maxWidth={120} unit="metric" />
    </>
  );
}