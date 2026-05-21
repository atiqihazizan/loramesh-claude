// src/hooks/useMapData.js
// ----------------------------------------------------------------
// Hook React Query untuk data asas peta E2-core.
//
// Pulangkan: center [lng,lat], zoom, senarai tiles, tile awal.
//
// Logik fallback pusat/zoom (ikut keutamaan):
//   1. user.agency.default_map_center  (kes /auth/me — bentuk penuh)
//   2. /auth/me  jika user.agency wujud tapi tiada medan map
//      (kes sejurus selepas /auth/login — bentuk ringkas {id,code,name})
//   3. /api/config  global  (kes superadmin tanpa agency)
//   4. FALLBACK_CENTER / FALLBACK_ZOOM  (config pun kosong/tak sah)
//
// SENGAJA tidak guna /api/settings/agency:
//   endpoint itu pulangkan 400 untuk superadmin tanpa agency_id,
//   dan perlu peranan admin. /auth/me bebas syarat itu.
// ----------------------------------------------------------------

import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useAuthStore } from '../store/authStore.js';
import {
  parseLatLng,
  matchTileProvider,
  FALLBACK_CENTER,
  FALLBACK_ZOOM,
} from '../lib/mapConfig.js';

// --- Ambil tiles dari /api/tiles --------------------------------
async function fetchTiles() {
  const res = await api.get('/tiles');
  return res.data?.tiles || [];
}

// --- Tentukan pusat/zoom ikut fallback 4-peringkat --------------
async function resolveCenterZoom(agencyFromStore) {
  // Peringkat 1 — agency dari store sudah ada medan map penuh.
  if (agencyFromStore?.default_map_center) {
    const center = parseLatLng(agencyFromStore.default_map_center);
    if (center) {
      return {
        center,
        zoom: agencyFromStore.default_map_zoom || FALLBACK_ZOOM,
        tileProvider: agencyFromStore.default_tile_provider || null,
        source: 'agency-store',
      };
    }
  }

  // Peringkat 2 — agency wujud tapi bentuk ringkas → ambil /auth/me.
  if (agencyFromStore?.id) {
    try {
      const res = await api.get('/auth/me');
      const agency = res.data?.user?.agency;
      if (agency?.default_map_center) {
        const center = parseLatLng(agency.default_map_center);
        if (center) {
          return {
            center,
            zoom: agency.default_map_zoom || FALLBACK_ZOOM,
            tileProvider: agency.default_tile_provider || null,
            source: 'agency-me',
          };
        }
      }
    } catch {
      // abai — jatuh ke peringkat seterusnya
    }
  }

  // Peringkat 3 — config global.
  try {
    const res = await api.get('/config');
    const cfg = res.data?.config;
    const center = parseLatLng(cfg?.latlng);
    if (center) {
      return {
        center,
        zoom: cfg.zoom || FALLBACK_ZOOM,
        tileProvider: null,
        source: 'config',
      };
    }
  } catch {
    // abai — jatuh ke fallback keras
  }

  // Peringkat 4 — fallback keras.
  return {
    center: FALLBACK_CENTER,
    zoom: FALLBACK_ZOOM,
    tileProvider: null,
    source: 'fallback',
  };
}

/**
 * Hook utama — gabung tiles + center/zoom + tile awal.
 *
 * @returns {object} { isLoading, isError, error, center, zoom,
 *                      tiles, initialTile }
 */
export function useMapData() {
  const agency = useAuthStore((s) => s.user?.agency);

  const query = useQuery({
    queryKey: ['map-data', agency?.id ?? 'no-agency'],
    queryFn: async () => {
      // Jalan dua-dua serentak — tiada saling bergantung.
      const [tiles, cz] = await Promise.all([
        fetchTiles(),
        resolveCenterZoom(agency),
      ]);

      const initialTile = matchTileProvider(cz.tileProvider, tiles);

      return {
        center: cz.center,
        zoom: cz.zoom,
        tiles,
        initialTile,
        source: cz.source,
      };
    },
    staleTime: 5 * 60 * 1000, // config peta jarang berubah
    retry: 1,
  });

  return {
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    center: query.data?.center ?? FALLBACK_CENTER,
    zoom: query.data?.zoom ?? FALLBACK_ZOOM,
    tiles: query.data?.tiles ?? [],
    initialTile: query.data?.initialTile ?? null,
  };
}