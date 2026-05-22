// src/map/MapControls.jsx
// ----------------------------------------------------------------
// Kawalan peta — zoom in/out sahaja.
//
// E2-ptz: compass terbina DIBUANG — digantikan MapCompass custom
// (ikon kompas berputar + reset utara). showCompass=false supaya
// tiada dua kompas. Pitch pula dikawal melalui Mod 3D, bukan di sini.
//
// Diletak di dalam <Map> sebagai child.
// ----------------------------------------------------------------

import { NavigationControl, ScaleControl } from 'react-map-gl/maplibre';

export default function MapControls() {
  return (
    <>
      {/* Zoom sahaja — sudut kanan bawah. Tiada compass. */}
      <NavigationControl
        position="bottom-right"
        showCompass={true}
        showZoom
      />

      {/* Bar skala — sudut kiri bawah */}
      <ScaleControl position="bottom-left" maxWidth={120} unit="metric" />
    </>
  );
}