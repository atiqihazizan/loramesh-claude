// E3-f — agency sites CRUD (GET/POST /sites, PATCH/DELETE /sites/:id)

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useAuthStore } from '../store/authStore.js';

function agencyQueryParams(agencyId, isSuperadmin) {
  if (isSuperadmin && agencyId != null) {
    return { agency_id: agencyId };
  }
  return {};
}

async function fetchSites(agencyId, isSuperadmin) {
  const res = await api.get('/sites', {
    params: agencyQueryParams(agencyId, isSuperadmin),
  });
  return res.data?.sites ?? [];
}

/**
 * @param {number|null|undefined} agencyId — superadmin target agency
 */
export function useAgencySites(agencyId) {
  const isAgencyAdmin = useAuthStore((s) => s.isAgencyAdmin());
  const isSuperadmin = useAuthStore((s) => s.isSuperadmin());
  const userAgencyId = useAuthStore((s) => s.user?.agency?.id);
  const effectiveId = isSuperadmin ? agencyId : userAgencyId;

  const queryClient = useQueryClient();
  const queryKey = ['sites', 'agency', effectiveId ?? 'none'];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchSites(effectiveId, isSuperadmin),
    enabled: isAgencyAdmin && effectiveId != null,
    staleTime: 15_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['sites', 'agency'] });
  };

  const createSite = useMutation({
    mutationFn: async (payload) => {
      const body = { ...payload };
      if (isSuperadmin && effectiveId != null) body.agency_id = effectiveId;
      const res = await api.post('/sites', body);
      return res.data?.site;
    },
    onSuccess: invalidate,
  });

  const updateSite = useMutation({
    mutationFn: async ({ id, patch }) => {
      const res = await api.patch(`/sites/${id}`, patch);
      return res.data?.site;
    },
    onSuccess: invalidate,
  });

  const removeSite = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/sites/${id}`);
      return res.data;
    },
    onSuccess: invalidate,
  });

  return {
    sites: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    createSite: createSite.mutateAsync,
    updateSite: updateSite.mutateAsync,
    removeSite: removeSite.mutateAsync,
    isCreating: createSite.isPending,
    isUpdating: updateSite.isPending,
    isRemoving: removeSite.isPending,
  };
}
