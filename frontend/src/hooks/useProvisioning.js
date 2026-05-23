// E5-b2 — provisioning nonce CRUD.
// GET/POST /provision, DELETE /provision/:id
// agencyId: superadmin passes target agency; admin agency passes null
// (backend uses caller's own agency).

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

async function fetchNonces(agencyId) {
  const params = {};
  if (agencyId != null) params.agency_id = agencyId;
  const res = await api.get('/provision/list', { params });
  return res.data?.nonces ?? [];
}

/**
 * @param {number|null} agencyId
 */
export function useProvisioning(agencyId) {
  const queryClient = useQueryClient();
  const key = ['provisioning', agencyId ?? 'self'];

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchNonces(agencyId),
    staleTime: 15_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });

  const createNonce = useMutation({
    mutationFn: async (payload) => {
      const body = { ...payload };
      if (agencyId != null) body.agency_id = agencyId;
      const res = await api.post('/provision', body);
      return res.data;
    },
    onSuccess: invalidate,
  });

  const revokeNonce = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/provision/${id}`);
      return res.data;
    },
    onSuccess: invalidate,
  });

  return {
    nonces: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    createNonce: createNonce.mutateAsync,
    revokeNonce: revokeNonce.mutateAsync,
    isCreating: createNonce.isPending,
    isRevoking: revokeNonce.isPending,
    lastCreated: createNonce.data ?? null,
  };
}
