// src/pages/MapPage.jsx
// ----------------------------------------------------------------
// Halaman Peta (laluan "/") — E2.
//
// E2-shell-fix: tidak lagi panggil useMapData. Data peta dimiliki
// MapLayout (melalui MapProvider). MapPage cuma baca keadaan
// loading/error dari context dan render MapView.
// ----------------------------------------------------------------

import { useMapContext } from '../map/MapContext.jsx';
import MapView from '../map/MapView.jsx';
import { errMsg } from '../lib/api.js';

export default function MapPage() {
  const { isLoading, isError, error } = useMapContext();

  // --- Loading ---------------------------------------------------
  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
          <p className="text-sm text-slate-500">Memuatkan peta…</p>
        </div>
      </div>
    );
  }

  // --- Error -----------------------------------------------------
  if (isError) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-50">
        <div className="max-w-sm rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          <p className="font-medium text-slate-800">Gagal memuatkan peta</p>
          <p className="mt-1 text-sm text-slate-500">
            {errMsg(error, 'Tidak dapat ambil data peta dari pelayan.')}
          </p>
        </div>
      </div>
    );
  }

  // --- Peta ------------------------------------------------------
  return (
    <div className="h-full w-full">
      <MapView />
    </div>
  );
}