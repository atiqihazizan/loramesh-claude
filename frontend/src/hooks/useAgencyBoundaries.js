// Agency boundaries CRUD — GET/POST /boundaries, PATCH/DELETE /boundaries/:id, POST /upload

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useAuthStore } from '../store/authStore.js';

function agencyQueryParams(agencyId, isSuperadmin) {
  if (isSuperadmin && agencyId != null) {
    return { agency_id: agencyId };
  }
  return {};
}

async function fetchBoundaries(agencyId, isSuperadmin) {
  const res = await api.get('/boundaries', {
    params: agencyQueryParams(agencyId, isSuperadmin),
  });
  return res.data?.features ?? [];
}

/**
 * @param {number|null|undefined} agencyId — superadmin target agency
 */
export function useAgencyBoundaries(agencyId) {
  const isAgencyAdmin = useAuthStore((s) => s.isAgencyAdmin());
  const isSuperadmin = useAuthStore((s) => s.isSuperadmin());
  const userAgencyId = useAuthStore((s) => s.user?.agency?.id);
  const effectiveId = isSuperadmin ? agencyId : userAgencyId;

  const queryClient = useQueryClient();
  const queryKey = ['boundaries', 'agency', effectiveId ?? 'none'];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchBoundaries(effectiveId, isSuperadmin),
    enabled: isAgencyAdmin && effectiveId != null,
    staleTime: 15_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['boundaries', 'agency'] });
  };

  const createBoundary = useMutation({
    mutationFn: async (payload) => {
      const body = { ...payload };
      if (isSuperadmin && effectiveId != null) body.agency_id = effectiveId;
      const res = await api.post('/boundaries', body);
      return res.data;
    },
    onSuccess: invalidate,
  });

  const updateBoundary = useMutation({
    mutationFn: async ({ id, patch }) => {
      const res = await api.patch(`/boundaries/${id}`, patch);
      return res.data;
    },
    onSuccess: invalidate,
  });

  const removeBoundary = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/boundaries/${id}`);
      return res.data;
    },
    onSuccess: invalidate,
  });

  const uploadBoundaries = useMutation({
    mutationFn: async ({ file, namePrefix }) => {
      const form = new FormData();
      form.append('file', file);
      if (namePrefix) form.append('name_prefix', namePrefix);
      if (isSuperadmin && effectiveId != null) {
        form.append('agency_id', String(effectiveId));
      }
      const res = await api.post('/boundaries/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: invalidate,
  });

  return {
    features: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    createBoundary: createBoundary.mutateAsync,
    updateBoundary: updateBoundary.mutateAsync,
    removeBoundary: removeBoundary.mutateAsync,
    uploadBoundaries: uploadBoundaries.mutateAsync,
    isCreating: createBoundary.isPending,
    isUpdating: updateBoundary.isPending,
    isRemoving: removeBoundary.isPending,
    isUploading: uploadBoundaries.isPending,
  };
}
