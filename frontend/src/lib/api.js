// src/lib/api.js
// Axios instance — auto sertakan JWT, auto handle 401.

import axios from 'axios';
import { loginPath } from './baseUrl.js';

function originWithoutTrailingSlash(url) {
  if (url == null || url === '') return '';
  return String(url).replace(/\/+$/, '');
}

const API_ORIGIN =
  import.meta.env.VITE_API_URL != null && import.meta.env.VITE_API_URL !== ''
    ? originWithoutTrailingSlash(import.meta.env.VITE_API_URL)
    : import.meta.env.PROD
      ? ''
      : 'http://localhost:5002';

export const api = axios.create({
  baseURL: `${API_ORIGIN}/api`,
  headers: { 'Content-Type': 'application/json' },
});

// Sertakan token pada setiap request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — token tamat / tak sah → logout
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const code = err.response.data?.code;
      // Jangan auto-logout untuk salah login biasa
      if (code === 'TOKEN_EXPIRED' || code === 'TOKEN_INVALID' || code === 'USER_INVALID') {
        localStorage.removeItem('token');
        const toLogin = loginPath();
        if (window.location.pathname !== toLogin) {
          window.location.href = toLogin;
        }
      }
    }
    return Promise.reject(err);
  }
);

// Helper — extract mesej error yang kemas
export function errMsg(err, fallback = 'Something went wrong') {
  return err?.response?.data?.error || err?.message || fallback;
}
