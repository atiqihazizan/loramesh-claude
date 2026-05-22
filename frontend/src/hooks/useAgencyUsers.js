// E3-c — agency user management (/settings/agency/users)
// Disable: DELETE /settings/agency/users/:id
// List response: { users: [...] }

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useAuthStore } from '../store/authStore.js';

function agencyQueryParams(agencyId, isSuperadmin) {
  if (isSuperadmin && agencyId != null) {
    return { agency_id: agencyId };
  }
  return {};
}

async function fetchAgencyUsers(agencyId, isSuperadmin) {
  const res = await api.get('/settings/agency/users', {
    params: agencyQueryParams(agencyId, isSuperadmin),
  });
  return res.data?.users ?? [];
}

/**
 * @param {number|null|undefined} agencyId — superadmin: target agency
 */
export function useAgencyUsers(agencyId) {
  const isAgencyAdmin = useAuthStore((s) => s.isAgencyAdmin());
  const isSuperadmin = useAuthStore((s) => s.isSuperadmin());
  const userAgencyId = useAuthStore((s) => s.user?.agency?.id);
  const effectiveId = isSuperadmin ? agencyId : userAgencyId;

  const queryClient = useQueryClient();
  const invalidateKey = ['settings', 'agency', 'users', effectiveId ?? 'none'];

  const query = useQuery({
    queryKey: invalidateKey,
    queryFn: () => fetchAgencyUsers(effectiveId, isSuperadmin),
    enabled: isAgencyAdmin && effectiveId != null,
    staleTime: 15_000,
  });

  const invalidateUsers = () => {
    queryClient.invalidateQueries({ queryKey: ['settings', 'agency', 'users'] });
  };

  const createUser = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/settings/agency/users', payload, {
        params: agencyQueryParams(effectiveId, isSuperadmin),
      });
      return res.data?.user;
    },
    onSuccess: invalidateUsers,
  });

  const updateUser = useMutation({
    mutationFn: async ({ id, patch }) => {
      const res = await api.patch(`/settings/agency/users/${id}`, patch, {
        params: agencyQueryParams(effectiveId, isSuperadmin),
      });
      return res.data?.user;
    },
    onSuccess: invalidateUsers,
  });

  const disableUser = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/settings/agency/users/${id}`, {
        params: agencyQueryParams(effectiveId, isSuperadmin),
      });
      return res.data;
    },
    onSuccess: invalidateUsers,
  });

  const resetPassword = useMutation({
    mutationFn: async ({ id, new_password }) => {
      const res = await api.post(
        `/settings/agency/users/${id}/password/reset`,
        { new_password },
        { params: agencyQueryParams(effectiveId, isSuperadmin) }
      );
      return res.data;
    },
    onSuccess: invalidateUsers,
  });

  return {
    users: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    createUser: createUser.mutateAsync,
    updateUser: updateUser.mutateAsync,
    disableUser: disableUser.mutateAsync,
    resetPassword: resetPassword.mutateAsync,
    isCreating: createUser.isPending,
    isUpdating: updateUser.isPending,
    isDisabling: disableUser.isPending,
    isResettingPassword: resetPassword.isPending,
  };
}
