// E5-c2 — agency provisioning token.
// GET/POST/DELETE /agencies/:id/provision-token

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

async function fetchStatus(agencyId) {
  const res = await api.get(`/agencies/${agencyId}/provision-token`);
  return res.data ?? null;
}

/**
 * @param {number|null} agencyId
 */
export function useAgencyToken(agencyId) {
  const queryClient = useQueryClient();
  const key = ['agency-token', agencyId];

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchStatus(agencyId),
    enabled: agencyId != null,
    staleTime: 10_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });

  const generate = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/agencies/${agencyId}/provision-token`);
      return res.data;
    },
    onSuccess: invalidate,
  });

  const endToken = useMutation({
    mutationFn: async () => {
      const res = await api.delete(`/agencies/${agencyId}/provision-token`);
      return res.data;
    },
    onSuccess: invalidate,
  });

  return {
    status: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    generate: generate.mutateAsync,
    endToken: endToken.mutateAsync,
    isGenerating: generate.isPending,
    isEnding: endToken.isPending,
  };
}
