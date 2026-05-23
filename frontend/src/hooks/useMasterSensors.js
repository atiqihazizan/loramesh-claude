// E5-a — master sensor CRUD (GET/POST /sensors, PATCH/DELETE /sensors/:id)

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

async function fetchSensors() {
  const res = await api.get('/sensors');
  return res.data?.sensors ?? [];
}

export function useMasterSensors() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['master-sensors'],
    queryFn: fetchSensors,
    staleTime: 60_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['master-sensors'] });
  };

  const createSensor = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/sensors', payload);
      return res.data?.sensor;
    },
    onSuccess: invalidate,
  });

  const updateSensor = useMutation({
    mutationFn: async ({ id, patch }) => {
      const res = await api.patch(`/sensors/${id}`, patch);
      return res.data?.sensor;
    },
    onSuccess: invalidate,
  });

  const removeSensor = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/sensors/${id}`);
      return res.data;
    },
    onSuccess: invalidate,
  });

  return {
    sensors: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    createSensor: createSensor.mutateAsync,
    updateSensor: updateSensor.mutateAsync,
    removeSensor: removeSensor.mutateAsync,
    isCreating: createSensor.isPending,
    isUpdating: updateSensor.isPending,
    isRemoving: removeSensor.isPending,
  };
}
