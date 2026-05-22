// src/map/MapContext.jsx
// ----------------------------------------------------------------
// Context dikongsi untuk data peta.
//
// Disediakan oleh MapLayout (pemilik). Diguna oleh:
//   - MapPage / MapView   → center, zoom, activeTile (bina style)
//   - MapTopOverlay       → tiles + activeTile + setActiveTile
//   - Map3DToggle         → is3D + setIs3D
//   - MapCompass          → mapRef (baca bearing/pitch, reset utara)
//
// E2-ptz: tambah is3D (mod 3D on/off) + mapRef (rujukan objek
// MapLibre, didaftar oleh MapView bila peta siap).
// ----------------------------------------------------------------

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
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

  // E2-ptz — mod 3D on/off.
  const [is3D, setIs3D] = useState(false);

  // E2-ptz — rujukan objek peta MapLibre. Bukan state (tak perlu
  // re-render bila ditetapkan); MapView daftar melalui setMapRef.
  const mapRef = useRef(null);
  const setMapRef = useCallback((map) => {
    mapRef.current = map;
  }, []);

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
      is3D,
      setIs3D,
      mapRef,
      setMapRef,
    }),
    [isLoading, isError, error, center, zoom, tiles, activeTile, is3D, setMapRef],
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