// Tiles CRUD (GET/POST /tiles, PATCH/DELETE /tiles/:id)
// NOTE: a read-only queryKey ['tiles'] is used elsewhere (map + agency settings
// dropdown); this hook is the full CRUD version for the superadmin page and
// invalidates both keys so the dropdown updates immediately after save.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

async function fetchTiles() {
  const res = await api.get('/tiles');
  return res.data?.tiles ?? [];
}

export function useTilesCrud() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['tiles-crud'],
    queryFn: fetchTiles,
    staleTime: 60_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['tiles-crud'] });
    queryClient.invalidateQueries({ queryKey: ['tiles'] });
  };

  const createTile = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/tiles', payload);
      return res.data?.tile;
    },
    onSuccess: invalidate,
  });

  const updateTile = useMutation({
    mutationFn: async ({ id, patch }) => {
      const res = await api.patch(`/tiles/${id}`, patch);
      return res.data?.tile;
    },
    onSuccess: invalidate,
  });

  const removeTile = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/tiles/${id}`);
      return res.data;
    },
    onSuccess: invalidate,
  });

  return {
    tiles: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    createTile: createTile.mutateAsync,
    updateTile: updateTile.mutateAsync,
    removeTile: removeTile.mutateAsync,
    isCreating: createTile.isPending,
    isUpdating: updateTile.isPending,
    isRemoving: removeTile.isPending,
  };
}