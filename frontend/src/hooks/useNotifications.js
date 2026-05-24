// useNotifications — list + mark read + realtime via Socket.IO

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { connectSocket } from '../lib/socket.js';

const NOTIFICATIONS_QUERY_KEY = ['notifications'];

async function fetchNotifications() {
  const res = await api.get('/notifications');
  return {
    notifications: res.data?.notifications ?? [],
    unreadCount: res.data?.unread_count ?? 0,
  };
}

export function useNotifications() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: fetchNotifications,
    staleTime: 30_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
  };

  const markReadMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.patch(`/notifications/${id}/read`);
      return res.data?.notification;
    },
    onSuccess: invalidate,
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await api.patch('/notifications/read-all');
    },
    onSuccess: invalidate,
  });

  useEffect(() => {
    const socket = connectSocket();

    const onNew = () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    };

    socket.on('notification:new', onNew);

    return () => {
      socket.off('notification:new', onNew);
    };
  }, [queryClient]);

  return {
    notifications: query.data?.notifications ?? [],
    unreadCount: query.data?.unreadCount ?? 0,
    isLoading: query.isLoading,
    markRead: markReadMutation.mutateAsync,
    markAllRead: markAllReadMutation.mutateAsync,
    isMarkingRead: markReadMutation.isPending,
    isMarkingAllRead: markAllReadMutation.isPending,
  };
}
