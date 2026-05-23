// E4-b — device list for the historical query form.
// GET /devices (optionally scoped by agency_id for superadmin).
// Non-superadmin: backend locks to their own agency automatically.

import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useAuthStore } from '../store/authStore.js';

async function fetchDevices(agencyId, isSuperadmin) {
  const params = {};
  if (isSuperadmin && agencyId != null) params.agency_id = agencyId;
  const res = await api.get('/devices', { params });
  return res.data?.devices ?? [];
}

/**
 * @param {number|null|undefined} agencyId — superadmin target agency
 */
export function useHistoricalDevices(agencyId) {
  const isSuperadmin = useAuthStore((s) => s.isSuperadmin());
  const userAgencyId = useAuthStore((s) => s.user?.agency?.id);
  const effectiveId = isSuperadmin ? agencyId : userAgencyId;

  const query = useQuery({
    queryKey: ['historical-devices', effectiveId ?? 'none'],
    queryFn: () => fetchDevices(effectiveId, isSuperadmin),
    enabled: effectiveId != null,
    staleTime: 30_000,
  });

  return {
    devices: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
