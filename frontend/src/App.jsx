// src/App.jsx
import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient.js';
import { useAuthStore } from './store/authStore.js';

import { RequireAuth, RequireSuperadmin, RedirectIfAuth } from './components/RouteGuards.jsx';
import PlaceholderPage from './pages/PlaceholderPage.jsx';
import SettingsIndexRedirect from './pages/settings/SettingsIndexRedirect.jsx';
import { routerBasename } from './lib/baseUrl.js';

const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));

const MapLayout = lazy(() => import('./components/layout/MapLayout.jsx'));
const MapPage = lazy(() => import('./pages/MapPage.jsx'));
const HistoricalLayout = lazy(() => import('./components/layout/HistoricalLayout.jsx'));
const HistoricalPage = lazy(() => import('./historical/HistoricalPage.jsx'));
const SettingsLayout = lazy(() => import('./components/layout/SettingsLayout.jsx'));
const DashboardLayout = lazy(() => import('./components/layout/DashboardLayout.jsx'));
const AgencySettingsPage = lazy(() => import('./pages/settings/AgencySettingsPage.jsx'));
const UsersPage = lazy(() => import('./pages/settings/UsersPage.jsx'));
const DevicesPage = lazy(() => import('./pages/settings/DevicesPage.jsx'));
const SitesPage = lazy(() => import('./pages/settings/SitesPage.jsx'));
const MyAccountPage = lazy(() => import('./pages/settings/MyAccountPage.jsx'));
const SensorsPage = lazy(() => import('./pages/settings/SensorsPage.jsx'));
const DeviceTypesPage = lazy(() => import('./pages/settings/DeviceTypesPage.jsx'));
const AgenciesPage = lazy(() => import('./pages/settings/AgenciesPage.jsx'));

function RouteFallback() {
  return (
    <div className="flex h-full min-h-[40vh] w-full items-center justify-center bg-slate-50">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600"
        aria-hidden
      />
    </div>
  );
}

export default function App() {
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={routerBasename}>
        <Suspense fallback={<RouteFallback />}>
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
              <Route path="/settings/agencies" element={<AgenciesPage />} />
              <Route path="/settings/sensors" element={<SensorsPage />} />
              <Route path="/settings/device-types" element={<DeviceTypesPage />} />
            </Route>

            {/* --- Kumpulan DASHBOARD --- */}
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

            <Route path="*" element={<PlaceholderPage title="404 — Page not found" />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
