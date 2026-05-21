// src/components/RouteGuards.jsx
// Lindung route — pastikan user login / ada peranan cukup.

import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import FullScreenLoader from './ui/FullScreenLoader.jsx';

// Perlu login
export function RequireAuth({ children }) {
  const { user, loading } = useAuthStore();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// Perlu SUPERADMIN
export function RequireSuperadmin({ children }) {
  const { user, loading } = useAuthStore();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.level?.code !== 'SUPERADMIN') return <Navigate to="/" replace />;
  return children;
}

// Halaman login — kalau dah login, lempar ke peta
export function RedirectIfAuth({ children }) {
  const { user, loading } = useAuthStore();
  if (loading) return <FullScreenLoader />;
  if (user) return <Navigate to="/" replace />;
  return children;
}
