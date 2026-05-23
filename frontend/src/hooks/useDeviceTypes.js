// E3-e — device type dropdown (GET /device-types)

import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

async function fetchDeviceTypes() {
  const res = await api.get('/device-types');
  return res.data?.device_types ?? [];
}

export function useDeviceTypes() {
  const query = useQuery({
    queryKey: ['device-types'],
    queryFn: fetchDeviceTypes,
    staleTime: 10 * 60 * 1000,
  });

  return {
    deviceTypes: query.data ?? [],
    isLoading: query.isLoading,
  };
}
