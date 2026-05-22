// src/map/MapContext.jsx
// ----------------------------------------------------------------
// Context dikongsi untuk data peta.
//
// Disediakan oleh MapLayout (pemilik). Diguna oleh:
//   - MapPage / MapView   → center, zoom, activeTile (bina style)
//   - MapTopOverlay       → tiles + activeTile + setActiveTile
//   - AgencyPicker        → selectedAgencyId + setSelectedAgencyId
//   - useDevices (hook)   → selectedAgencyId (agency mana nak dimuat)
//
// E2-markers-a: tambah selectedAgencyId — agency yang sedang ditonton.
//   - Pengguna biasa  : terkunci pada user.agency.id
//   - Superadmin      : null pada mula; AgencyPicker tetapkannya
// ----------------------------------------------------------------

import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useMapData } from '../hooks/useMapData.js';
import { useAuthStore } from '../store/authStore.js';

const MapContext = createContext(null);

/**
 * Provider — dibungkus sekali di MapLayout.
 */
export function MapProvider({ children }) {
  const { isLoading, isError, error, center, zoom, tiles, initialTile } =
    useMapData();

  const userAgencyId = useAuthStore((s) => s.user?.agency?.id ?? null);

  // State tile aktif — diangkat ke sini supaya dikongsi.
  const [activeTile, setActiveTile] = useState(null);

  // Agency yang sedang ditonton.
  //   Pengguna biasa → terus user.agency.id.
  //   Superadmin (user.agency null) → null; AgencyPicker tetapkan.
  const [selectedAgencyId, setSelectedAgencyId] = useState(userAgencyId);

  // Set tile awal sebaik useMapData siap (sekali sahaja).
  useEffect(() => {
    if (initialTile && !activeTile) {
      setActiveTile(initialTile);
    }
  }, [initialTile, activeTile]);

  // Jaga-jaga: bila user.agency.id muncul (cth selepas /auth/me),
  // dan selectedAgencyId masih kosong, selaraskan.
  useEffect(() => {
    if (userAgencyId && selectedAgencyId == null) {
      setSelectedAgencyId(userAgencyId);
    }
  }, [userAgencyId, selectedAgencyId]);

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
      selectedAgencyId,
      setSelectedAgencyId,
    }),
    [
      isLoading,
      isError,
      error,
      center,
      zoom,
      tiles,
      activeTile,
      selectedAgencyId,
    ],
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