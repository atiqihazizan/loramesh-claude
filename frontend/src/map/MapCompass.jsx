// src/map/MapCompass.jsx
// ----------------------------------------------------------------
// Ikon kompas berputar — penunjuk arah peta.
//
//   - Jarum berputar mengikut bearing peta secara langsung
//     (dengar peristiwa 'rotate' MapLibre).
//   - Sedikit kecondongan visual mengikut pitch (beri rasa 3D).
//   - Klik → reset utara (bearing 0) + ratakan (pitch 0), licin.
//
// Terapung kiri-bawah supaya tidak berlanggar zoom / Map3DToggle
// di kanan-bawah. Hanya dipaparkan apabila Mod 3D aktif.
// ----------------------------------------------------------------

import { useState, useEffect, useCallback } from 'react';
import { Navigation } from 'lucide-react';
import { useMapContext } from './MapContext.jsx';

export default function MapCompass() {
  const { mapRef, is3D } = useMapContext();
  const [bearing, setBearing] = useState(0);
  const [pitch, setPitch] = useState(0);

  // Dengar peristiwa kamera MapLibre — kemas kini jarum.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const sync = () => {
      setBearing(map.getBearing());
      setPitch(map.getPitch());
    };

    // Selaraskan sekali pada mula, kemudian ikut setiap gerakan.
    sync();
    map.on('rotate', sync);
    map.on('pitch', sync);

    return () => {
      map.off('rotate', sync);
      map.off('pitch', sync);
    };
    // mapRef objek stabil; is3D dimasukkan supaya sync semula bila
    // peta didaftar selepas Mod 3D dihidupkan.
  }, [mapRef, is3D]);

  // Klik — reset utara + ratakan.
  const handleReset = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ bearing: 0, pitch: 0, duration: 500 });
  }, [mapRef]);

  // Jangan papar bila Mod 3D tidak aktif.
  if (!is3D) return null;

  return (
    <button
      type="button"
      onClick={handleReset}
      title="Reset ke utara"
      className="absolute bottom-8 left-3 z-20 flex h-11 w-11 items-center
                 justify-center rounded-full bg-white/95 shadow-lg
                 ring-1 ring-slate-200 backdrop-blur transition-colors
                 hover:bg-slate-100"
    >
      {/* Jarum — putar songsang bearing supaya 'N' sentiasa tunjuk
          arah utara sebenar. Skala-Y ikut pitch beri rasa condong. */}
      <span
        className="flex items-center justify-center"
        style={{
          transform: `rotate(${-bearing}deg) scaleY(${1 - pitch / 200})`,
          transition: 'transform 80ms linear',
        }}
      >
        <Navigation
          size={20}
          strokeWidth={2}
          className="fill-red-500 text-red-500"
        />
      </span>
    </button>
  );
}