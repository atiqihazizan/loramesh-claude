// src/App.jsx
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient.js';
import { useAuthStore } from './store/authStore.js';

import { RequireAuth, RequireSuperadmin, RedirectIfAuth } from './components/RouteGuards.jsx';
import MapLayout from './components/layout/MapLayout.jsx';            // E2-shell — layout peta
import DashboardLayout from './components/layout/DashboardLayout.jsx'; // E2-shell — layout dashboard
import SettingsLayout from './components/layout/SettingsLayout.jsx';   // E3-a — settings layout
import HistoricalLayout from './components/layout/HistoricalLayout.jsx'; // E4-a — historical layout
import LoginPage from './pages/LoginPage.jsx';
import PlaceholderPage from './pages/PlaceholderPage.jsx';
import MapPage from './pages/MapPage.jsx';   // E2 — halaman peta
import SettingsIndexRedirect from './pages/settings/SettingsIndexRedirect.jsx';
import AgencySettingsPage from './pages/settings/AgencySettingsPage.jsx';
import UsersPage from './pages/settings/UsersPage.jsx';
import DevicesPage from './pages/settings/DevicesPage.jsx';
import SitesPage from './pages/settings/SitesPage.jsx';
import MyAccountPage from './pages/settings/MyAccountPage.jsx';
import HistoricalPage from './historical/HistoricalPage.jsx'; // E4-a — halaman historical

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
          </Route>

          {/* --- E4 Historical — own layout --- */}
          <Route
            element={
              <RequireAuth>
                <HistoricalLayout />
              </RequireAuth>
            }
          >
            <Route path="/historical" element={<HistoricalPage />} />
          </Route>

          {/* --- E3 Settings — own layout + sub-routes --- */}
          <Route
            element={
              <RequireAuth>
                <SettingsLayout />
              </RequireAuth>
            }
          >
            <Route path="/settings" element={<SettingsIndexRedirect />} />
            <Route path="/settings/agency" element={<AgencySettingsPage />} />
            <Route path="/settings/devices" element={<DevicesPage />} />
            <Route path="/settings/sites" element={<SitesPage />} />
            <Route path="/settings/users" element={<UsersPage />} />
            <Route path="/settings/account" element={<MyAccountPage />} />
          </Route>

          {/* --- Kumpulan DASHBOARD — guna DashboardLayout (sidebar + kandungan) --- */}
          <Route
            element={
              <RequireAuth>
                <DashboardLayout />
              </RequireAuth>
            }
          >
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
          <Route path="*" element={<PlaceholderPage title="404 — Page not found" />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
