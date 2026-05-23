// Playback track + summary for a device over a date range.
// GET /playback/:id?from=&to=&resolution=auto  → track points
// GET /playback/:id/summary?from=&to=          → distance/speed/duration

import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

async function fetchTrack(deviceId, from, to) {
  const res = await api.get(`/playback/${encodeURIComponent(deviceId)}`, {
    params: { from, to, resolution: 'auto' },
  });
  return res.data ?? null;
}

async function fetchSummary(deviceId, from, to) {
  const res = await api.get(
    `/playback/${encodeURIComponent(deviceId)}/summary`,
    { params: { from, to } }
  );
  return res.data ?? null;
}

/**
 * @param {object|null} query — { deviceId, from, to } from HistoricalContext
 */
export function usePlayback(query) {
  const enabled = !!query?.deviceId && !!query?.from && !!query?.to;

  const trackQuery = useQuery({
    queryKey: ['playback-track', query?.deviceId, query?.from, query?.to],
    queryFn: () => fetchTrack(query.deviceId, query.from, query.to),
    enabled,
    staleTime: 60_000,
  });

  const summaryQuery = useQuery({
    queryKey: ['playback-summary', query?.deviceId, query?.from, query?.to],
    queryFn: () => fetchSummary(query.deviceId, query.from, query.to),
    enabled,
    staleTime: 60_000,
  });

  return {
    track: trackQuery.data ?? null,
    summary: summaryQuery.data ?? null,
    isLoading: trackQuery.isLoading || summaryQuery.isLoading,
    isError: trackQuery.isError || summaryQuery.isError,
    error: trackQuery.error || summaryQuery.error,
  };
}
