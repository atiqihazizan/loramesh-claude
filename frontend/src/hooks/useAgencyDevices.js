// E3-e — agency device CRUD (GET/POST /devices, PATCH/DELETE /devices/:id)
// Do not confuse with useDevices.js (live map markers).

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useAuthStore } from '../store/authStore.js';

function agencyQueryParams(agencyId, isSuperadmin) {
  if (isSuperadmin && agencyId != null) {
    return { agency_id: agencyId };
  }
  return {};
}

async function fetchDevices(agencyId, isSuperadmin, search) {
  const params = { ...agencyQueryParams(agencyId, isSuperadmin), approval: 'all' };
  if (search?.trim()) params.search = search.trim();
  const res = await api.get('/devices', { params });
  return res.data?.devices ?? [];
}

/**
 * @param {number|null|undefined} agencyId — superadmin target agency
 * @param {string} [search]
 */
export function useAgencyDevices(agencyId, search = '') {
  const isAgencyAdmin = useAuthStore((s) => s.isAgencyAdmin());
  const isSuperadmin = useAuthStore((s) => s.isSuperadmin());
  const userAgencyId = useAuthStore((s) => s.user?.agency?.id);
  const effectiveId = isSuperadmin ? agencyId : userAgencyId;

  const queryClient = useQueryClient();
  const queryKey = ['devices', 'agency', effectiveId ?? 'none', search];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchDevices(effectiveId, isSuperadmin, search),
    enabled: isAgencyAdmin && effectiveId != null,
    staleTime: 15_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['devices', 'agency'] });
  };

  const createDevice = useMutation({
    mutationFn: async (payload) => {
      const body = { ...payload };
      if (isSuperadmin && effectiveId != null) body.agency_id = effectiveId;
      const res = await api.post('/devices', body);
      return res.data?.device;
    },
    onSuccess: invalidate,
  });

  const updateDevice = useMutation({
    mutationFn: async ({ id, patch }) => {
      const res = await api.patch(`/devices/${id}`, patch);
      return res.data?.device;
    },
    onSuccess: invalidate,
  });

  const removeDevice = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/devices/${id}`);
      return res.data;
    },
    onSuccess: invalidate,
  });

  const approveDeviceMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.patch(`/devices/${id}/approve`);
      return res.data?.device;
    },
    onSuccess: invalidate,
  });

  return {
    devices: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    createDevice: createDevice.mutateAsync,
    updateDevice: updateDevice.mutateAsync,
    removeDevice: removeDevice.mutateAsync,
    approveDevice: approveDeviceMutation.mutateAsync,
    isCreating: createDevice.isPending,
    isUpdating: updateDevice.isPending,
    isRemoving: removeDevice.isPending,
    isApproving: approveDeviceMutation.isPending,
  };
}
