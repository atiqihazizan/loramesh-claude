// src/map/MapContext.jsx
// ----------------------------------------------------------------
// Context dikongsi untuk data peta.
//
// Disediakan oleh MapLayout (pemilik). Diguna oleh:
//   - MapPage / MapView   → center, zoom, activeTile (bina style)
//   - MapTopOverlay       → tiles + activeTile + setActiveTile
//                            (butang basemap switcher)
//   - (E2-ptz nanti)      → kawalan kamera
//
// MapLayout panggil useMapData sekali, simpan activeTile di sini,
// jadi MapView dan MapTopOverlay berkongsi satu sumber kebenaran.
// ----------------------------------------------------------------

import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useMapData } from '../hooks/useMapData.js';

const MapContext = createContext(null);

/**
 * Provider — dibungkus sekali di MapLayout.
 */
export function MapProvider({ children }) {
  const { isLoading, isError, error, center, zoom, tiles, initialTile } =
    useMapData();

  // State tile aktif — diangkat ke sini supaya dikongsi.
  const [activeTile, setActiveTile] = useState(null);

  // Set tile awal sebaik useMapData siap (sekali sahaja).
  useEffect(() => {
    if (initialTile && !activeTile) {
      setActiveTile(initialTile);
    }
  }, [initialTile, activeTile]);

  const value = useMemo(
    () => ({
      isLoading,
      isError,
      error,
      center,
      zoom,
      tiles,
      activeTile,
      setActiveTile,
    }),
    [isLoading, isError, error, center, zoom, tiles, activeTile],
  );

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
}

/**
 * Hook pengguna — panggil dalam mana-mana komponen di bawah MapLayout.
 * @returns {object} nilai context peta
 */
export function useMapContext() {
  const ctx = useContext(MapContext);
  if (!ctx) {
    throw new Error('useMapContext mesti diguna dalam <MapProvider>');
  }
  return ctx;
}