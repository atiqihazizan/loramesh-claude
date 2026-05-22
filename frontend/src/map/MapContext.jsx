// src/map/MapContext.jsx
// ----------------------------------------------------------------
// Context dikongsi untuk data peta.
//
// Disediakan oleh MapLayout (pemilik). Diguna oleh:
//   - MapPage / MapView   → center, zoom, activeTile (bina style)
//   - MapTopOverlay       → tiles + activeTile + setActiveTile
//   - AgencyPicker        → selectedAgencyId + setSelectedAgencyId
//   - useDevices (hook)   → selectedAgencyId
//   - DeviceLayer         → selectedDeviceId + setSelectedDeviceId
//   - DeviceDetailPanel   → selectedDeviceId (device mana nak papar)
//
// selectedDeviceId — "papan kenyataan kongsi": DeviceLayer tulis
// (bila marker diklik), DeviceDetailPanel baca. Simpan device_id
// SAHAJA (bukan objek penuh) — panel cari device terkini dari
// useDevices, jadi sentiasa segar bila socket kemas kini nanti.
// ----------------------------------------------------------------

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
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
  const [selectedAgencyId, setSelectedAgencyId] = useState(userAgencyId);

  // device_id device yang dipilih untuk panel detail (atau null).
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);

  // Set code device_type yang DISEMBUNYIKAN (penapis type).
  // TypeFilter (overlay) tulis; DeviceLayer baca untuk tapis marker.
  const [hiddenTypeCodes, setHiddenTypeCodes] = useState(() => new Set());

  const toggleTypeCode = useCallback((code) => {
    setHiddenTypeCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  // Set tile awal sebaik useMapData siap (sekali sahaja).
  useEffect(() => {
    if (initialTile && !activeTile) {
      setActiveTile(initialTile);
    }
  }, [initialTile, activeTile]);

  // Jaga-jaga: selaraskan agency bila user.agency.id muncul.
  useEffect(() => {
    if (userAgencyId && selectedAgencyId == null) {
      setSelectedAgencyId(userAgencyId);
    }
  }, [userAgencyId, selectedAgencyId]);

  // Tukar agency → tutup panel detail + reset penapis type
  // (device & type lama tiada kaitan dengan agency baharu).
  useEffect(() => {
    setSelectedDeviceId(null);
    setHiddenTypeCodes(new Set());
  }, [selectedAgencyId]);

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
      selectedDeviceId,
      setSelectedDeviceId,
      hiddenTypeCodes,
      toggleTypeCode,
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
      selectedDeviceId,
      hiddenTypeCodes,
      toggleTypeCode,
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
    throw new Error('useMapContext must be used within <MapProvider>');
  }
  return ctx;
}