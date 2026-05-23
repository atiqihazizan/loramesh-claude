// E4-b2 — playback date bounds for a device.
// GET /playback/:deviceId/bounds → { earliest, latest, total_points }
// Used to constrain the historical range calendar.

import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

async function fetchBounds(deviceId) {
  const res = await api.get(`/playback/${encodeURIComponent(deviceId)}/bounds`);
  return res.data ?? null;
}

/**
 * @param {string} deviceId — device_id (empty/null disables the query)
 */
export function usePlaybackBounds(deviceId) {
  const query = useQuery({
    queryKey: ['playback-bounds', deviceId || 'none'],
    queryFn: () => fetchBounds(deviceId),
    enabled: !!deviceId,
    staleTime: 60_000,
  });

  return {
    bounds: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
