// src/App.jsx
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient.js';
import { useAuthStore } from './store/authStore.js';

import { RequireAuth, RequireSuperadmin, RedirectIfAuth } from './components/RouteGuards.jsx';
import MapLayout from './components/layout/MapLayout.jsx';            // E2-shell — layout peta
import DashboardLayout from './components/layout/DashboardLayout.jsx'; // E2-shell — layout dashboard
import LoginPage from './pages/LoginPage.jsx';
import PlaceholderPage from './pages/PlaceholderPage.jsx';
import MapPage from './pages/MapPage.jsx';   // E2 — halaman peta

export default function App() {
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Login */}
          <Route
            path="/login"
            element={
              <RedirectIfAuth>
                <LoginPage />
              </RedirectIfAuth>
            }
          />

          {/* --- Kumpulan PETA — guna MapLayout (peta penuh + overlay) --- */}
          <Route
            element={
              <RequireAuth>
                <MapLayout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<MapPage />} />
            <Route path="/historical" element={<PlaceholderPage title="Sejarah" />} />
          </Route>

          {/* --- Kumpulan DASHBOARD — guna DashboardLayout (sidebar + kandungan) --- */}
          <Route
            element={
              <RequireAuth>
                <DashboardLayout />
              </RequireAuth>
            }
          >
            <Route path="/settings" element={<PlaceholderPage title="Tetapan" />} />
            <Route
              path="/admin"
              element={
                <RequireSuperadmin>
                  <PlaceholderPage title="Admin" />
                </RequireSuperadmin>
              }
            />
          </Route>

          {/* Apa-apa lain → 404 */}
          <Route path="*" element={<PlaceholderPage title="404 — Tiada Halaman" />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}