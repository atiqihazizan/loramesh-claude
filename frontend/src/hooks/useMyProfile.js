// E3-d — self profile (GET /auth/me + PATCH /settings/me)

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useAuthStore } from '../store/authStore.js';

export function useMyProfile() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();

  const updateProfile = useMutation({
    mutationFn: async (patch) => {
      const res = await api.patch('/settings/me', patch);
      return res.data?.preferences ?? res.data?.user ?? res.data;
    },
    onSuccess: (prefs) => {
      if (user && prefs) {
        setUser({
          ...user,
          name: prefs.name ?? user.name,
          email: prefs.email ?? user.email,
          phone_number: prefs.phone_number ?? user.phone_number,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });

  return {
    user,
    updateProfile: updateProfile.mutateAsync,
    isSaving: updateProfile.isPending,
    saveError: updateProfile.error,
  };
}
