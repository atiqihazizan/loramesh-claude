// src/map/MapContext.jsx
// ----------------------------------------------------------------
// Shared context for map data.
//
// Provided by MapLayout (the owner). Consumed by:
//   - MapPage / MapView   → center, zoom, activeTile (build style)
//   - MapTopOverlay       → tiles + activeTile + setActiveTile
//   - AgencyPicker        → selectedAgencyId + setSelectedAgencyId
//   - useDevices (hook)   → selectedAgencyId
//   - DeviceLayer         → selectedDeviceId + hiddenTypeCodes
//   - DeviceDetailPanel   → selectedDeviceId
//
// E2-markers-b: MapProvider also activates the realtime device
// socket (useDeviceSocket) — it lives as long as the map page.
// ----------------------------------------------------------------

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useMapData } from '../hooks/useMapData.js';
import { useDeviceSocket } from '../hooks/useDeviceSocket.js';
import { useAuthStore } from '../store/authStore.js';

const MapContext = createContext(null);

/**
 * Provider — wrapped once in MapLayout.
 */
export function MapProvider({ children }) {
  const { isLoading, isError, error, center, zoom, tiles, initialTile } =
    useMapData();

  const userAgencyId = useAuthStore((s) => s.user?.agency?.id ?? null);

  // Active basemap tile — lifted here so it is shared.
  const [activeTile, setActiveTile] = useState(null);

  // Agency currently being viewed.
  const [selectedAgencyId, setSelectedAgencyId] = useState(userAgencyId);

  // device_id of the device selected for the detail panel (or null).
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);

  // Follow camera on/off. When on AND a device is selected, the
  // map follows that device's position on each socket update.
  const [followMode, setFollowMode] = useState(false);

  // Set of device_type codes that are HIDDEN (type filter).
  const [hiddenTypeCodes, setHiddenTypeCodes] = useState(() => new Set());

  const toggleTypeCode = useCallback((code) => {
    setHiddenTypeCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  // E6-typefilter: flyTo target — { lng, lat, zoom, nonce }.
  // TypeFilter (overlay luar <Map>) panggil flyTo(); FlyToController
  // dalam <Map> dengar nonce dan laksanakan map.flyTo().
  const [flyToTarget, setFlyToTarget] = useState(null);

  const flyTo = useCallback((lng, lat, zoom = 15) => {
    setFlyToTarget({ lng, lat, zoom, nonce: Date.now() });
  }, []);

  // Set the initial tile once useMapData is ready.
  useEffect(() => {
    if (initialTile && !activeTile) {
      setActiveTile(initialTile);
    }
  }, [initialTile, activeTile]);

  // Safety: sync agency once user.agency.id appears.
  useEffect(() => {
    if (userAgencyId && selectedAgencyId == null) {
      setSelectedAgencyId(userAgencyId);
    }
  }, [userAgencyId, selectedAgencyId]);

  // Agency change → close detail panel, reset type filter, and
  // turn follow off (the followed device belongs to the old agency).
  useEffect(() => {
    setSelectedDeviceId(null);
    setHiddenTypeCodes(new Set());
    setFollowMode(false);
  }, [selectedAgencyId]);

  // E2-markers-b: activate the realtime device socket. Pass
  // selectedAgencyId as an argument (not via context) to avoid a
  // circular import. Patches the React Query cache internally.
  useDeviceSocket(selectedAgencyId);

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
      followMode,
      setFollowMode,
      flyTo,
      flyToTarget,
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
      followMode,
      flyTo,
      flyToTarget,
    ],
  );

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
}

/**
 * Consumer hook — use in any component under MapLayout.
 * @returns {object} map context value
 */
export function useMapContext() {
  const ctx = useContext(MapContext);
  if (!ctx) {
    throw new Error('useMapContext must be used within <MapProvider>');
  }
  return ctx;
}
