// src/store/authStore.js
// State global untuk user yang login. Guna Zustand.

import { create } from 'zustand';
import { api } from '../lib/api.js';

export const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('token') || null,
  loading: true,        // true masa mula — tengah check token sedia ada
  error: null,

  // Dipanggil masa app mula — kalau ada token, ambil user
  init: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ loading: false, user: null });
      return;
    }
    try {
      const res = await api.get('/auth/me');
      set({ user: res.data.user, token, loading: false });
    } catch {
      localStorage.removeItem('token');
      set({ user: null, token: null, loading: false });
    }
  },

  login: async (username, password) => {
    set({ error: null });
    try {
      const res = await api.post('/auth/login', {
        username,
        password,
        device_type: 'Web',
      });
      const { token, user } = res.data;
      localStorage.setItem('token', token);
      set({ user, token, error: null });
      return { ok: true, user };
    } catch (err) {
      const msg = err?.response?.data?.error || 'Log masuk gagal';
      set({ error: msg });
      return { ok: false, error: msg };
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // abai — logout tetap teruskan
    }
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },

  // Update user dalam store (cth lepas tukar password / settings)
  setUser: (user) => set({ user }),

  // Helper peranan
  isSuperadmin: () => get().user?.level?.code === 'SUPERADMIN',
  isAgencyAdmin: () => {
    const code = get().user?.level?.code;
    return code === 'ADMIN_AGENCY' || code === 'SUPERADMIN';
  },
}));
