// E5-a — device type CRUD (GET/POST /device-types, PATCH/DELETE /device-types/:id)
// NOTE: a read-only hook `useDeviceTypes` already exists for dropdowns;
// this hook is the full CRUD version for the admin page — different name.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

async function fetchDeviceTypes() {
  const res = await api.get('/device-types');
  return res.data?.device_types ?? [];
}

export function useDeviceTypesCrud() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['device-types-crud'],
    queryFn: fetchDeviceTypes,
    staleTime: 60_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['device-types-crud'] });
    queryClient.invalidateQueries({ queryKey: ['device-types'] });
  };

  const createType = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/device-types', payload);
      return res.data?.device_type;
    },
    onSuccess: invalidate,
  });

  const updateType = useMutation({
    mutationFn: async ({ id, patch }) => {
      const res = await api.patch(`/device-types/${id}`, patch);
      return res.data?.device_type;
    },
    onSuccess: invalidate,
  });

  const removeType = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/device-types/${id}`);
      return res.data;
    },
    onSuccess: invalidate,
  });

  return {
    deviceTypes: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    createType: createType.mutateAsync,
    updateType: updateType.mutateAsync,
    removeType: removeType.mutateAsync,
    isCreating: createType.isPending,
    isUpdating: updateType.isPending,
    isRemoving: removeType.isPending,
  };
}
