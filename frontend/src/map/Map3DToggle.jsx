// src/map/Map3DToggle.jsx
// ----------------------------------------------------------------
// Butang toggle Mod 3D — terapung kanan-bawah, atas kawalan zoom.
//
//   Off → peta rata; seret hanya pan (dragRotate dimatikan di MapView).
//   On  → peta dicondong ~50° serta-merta (easeTo licin); seret-kanan
//         / dua-jari boleh putar + condong.
//
// Bila dimatikan, ThreeDWatcher dalam MapView easeTo peta balik rata.
// ----------------------------------------------------------------

import { useCallback } from 'react';
import { Box } from 'lucide-react';
import { useMapContext } from './MapContext.jsx';

// Sudut condong awal bila Mod 3D dihidupkan.
// 60° — titik mula yang selesa; pengguna boleh condong lagi
// (hingga 85°) dengan seret atas dalam Mod 3D.
const INITIAL_3D_PITCH = 60;

export default function Map3DToggle() {
  const { is3D, setIs3D, mapRef } = useMapContext();

  const handleToggle = useCallback(() => {
    const next = !is3D;
    setIs3D(next);

    // Bila hidupkan 3D — terus condong supaya kesan nampak serta-merta.
    // Bila matikan — ThreeDWatcher di MapView yang easeTo balik rata.
    if (next && mapRef.current) {
      mapRef.current.easeTo({ pitch: INITIAL_3D_PITCH, duration: 500 });
    }
  }, [is3D, setIs3D, mapRef]);

  return (
    <button
      type="button"
      onClick={handleToggle}
      title={is3D ? 'Matikan Mod 3D' : 'Hidupkan Mod 3D'}
      className={
        'absolute bottom-28 right-3 z-20 flex h-9 w-9 items-center ' +
        'justify-center rounded-lg shadow-lg ring-1 transition-colors ' +
        (is3D
          ? 'bg-blue-600 text-white ring-blue-600'
          : 'bg-white/95 text-slate-600 ring-slate-200 backdrop-blur hover:bg-slate-100')
      }
    >
      <Box size={18} strokeWidth={2} />
    </button>
  );
}