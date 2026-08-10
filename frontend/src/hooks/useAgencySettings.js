// E3-a — agency settings (GET/PATCH /settings/agency)
// agencyId: required for superadmin (?agency_id=); others use JWT agency.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useAuthStore } from '../store/authStore.js';

function agencyQueryParams(agencyId, isSuperadmin) {
  if (isSuperadmin && agencyId != null) {
    return { agency_id: agencyId };
  }
  return {};
}

async function fetchAgencySettings(agencyId, isSuperadmin) {
  const res = await api.get('/settings/agency', {
    params: agencyQueryParams(agencyId, isSuperadmin),
  });
  return res.data?.agency ?? null;
}

/**
 * @param {number|null|undefined} agencyId — superadmin: target agency
 */
export function useAgencySettings(agencyId) {
  const isAgencyAdmin = useAuthStore((s) => s.isAgencyAdmin());
  const isSuperadmin = useAuthStore((s) => s.isSuperadmin());
  const userAgencyId = useAuthStore((s) => s.user?.agency?.id);
  const effectiveId = isSuperadmin ? agencyId : userAgencyId;

  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['settings', 'agency', effectiveId ?? 'none'],
    queryFn: () => fetchAgencySettings(effectiveId, isSuperadmin),
    enabled: isAgencyAdmin && effectiveId != null,
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: async (patch) => {
      const res = await api.patch('/settings/agency', patch, {
        params: agencyQueryParams(effectiveId, isSuperadmin),
      });
      return res.data?.agency;
    },
    onSuccess: (updatedAgency) => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'agency'] });
      queryClient.resetQueries({ queryKey: ['map-data'] });

      // Patch authStore so map reads fresh center/zoom without full re-login
      if (updatedAgency) {
        const { user, setUser } = useAuthStore.getState();
        if (user?.agency?.id === updatedAgency.id) {
          setUser({ ...user, agency: { ...user.agency, ...updatedAgency } });
        }
      }
    },
  });

  return {
    agency: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    updateAgency: mutation.mutateAsync,
    isSaving: mutation.isPending,
    saveError: mutation.error,
  };
}
