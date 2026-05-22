// src/hooks/useDevices.js
// ----------------------------------------------------------------
// Ambil senarai device untuk agency yang sedang ditonton.
//
// GET /api/devices?agency_id={selectedAgencyId}
//
// E2-markers-a (statik sahaja):
//   - Tapis device tanpa koordinat (latitude/longitude null) —
//     tak boleh letak marker tanpa posisi.
//   - Kunci device ialah `device_id` (string) — sebab patch socket
//     nanti (E2-markers-b) hanya ada device_id, bukan id nombor.
//   - Status dibaca dari medan `status` (REST). Socket nanti guna
//     `status_live` — akan dinormalkan di lapisan socket.
// ----------------------------------------------------------------

import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useMapContext } from '../map/MapContext.jsx';

async function fetchDevices(agencyId) {
  const res = await api.get('/devices', {
    params: { agency_id: agencyId },
  });
  return res.data?.devices || [];
}

// Sahkan koordinat — number terhingga dalam julat bumi.
function hasValidCoords(d) {
  const { latitude: lat, longitude: lng } = d;
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  return true;
}

/**
 * @returns {object} { devices, isLoading, isError, error }
 *   devices — hanya device dengan koordinat sah
 */
export function useDevices() {
  const { selectedAgencyId } = useMapContext();

  const query = useQuery({
    queryKey: ['devices', selectedAgencyId],
    queryFn: () => fetchDevices(selectedAgencyId),
    // Jangan jalan sehingga ada agency dipilih.
    enabled: selectedAgencyId != null,
    staleTime: 30 * 1000,
  });

  // Tapis device tanpa koordinat — tak boleh dirender sebagai marker.
  const devices = (query.data ?? []).filter(hasValidCoords);

  return {
    devices,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}