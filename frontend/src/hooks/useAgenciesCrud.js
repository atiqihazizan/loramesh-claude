// E5-b1 — agency CRUD (superadmin). GET/POST /agencies, PATCH/DELETE /agencies/:id
// NOTE: a read-only hook `useAgencies` already exists for the picker;
// this is the full CRUD version — different name. Do not touch useAgencies.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

async function fetchAgencies() {
  const res = await api.get('/agencies', { params: { include_inactive: true } });
  return res.data?.agencies ?? [];
}

export function useAgenciesCrud() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['agencies-crud'],
    queryFn: fetchAgencies,
    staleTime: 60_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['agencies-crud'] });
    queryClient.invalidateQueries({ queryKey: ['agencies'] });
  };

  const createAgency = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/agencies', payload);
      return res.data;
    },
    onSuccess: invalidate,
  });

  const updateAgency = useMutation({
    mutationFn: async ({ id, patch }) => {
      const res = await api.patch(`/agencies/${id}`, patch);
      return res.data?.agency;
    },
    onSuccess: invalidate,
  });

  const disableAgency = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/agencies/${id}`);
      return res.data;
    },
    onSuccess: invalidate,
  });

  return {
    agencies: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    createAgency: createAgency.mutateAsync,
    updateAgency: updateAgency.mutateAsync,
    disableAgency: disableAgency.mutateAsync,
    isCreating: createAgency.isPending,
    isUpdating: updateAgency.isPending,
    isDisabling: disableAgency.isPending,
  };
}
