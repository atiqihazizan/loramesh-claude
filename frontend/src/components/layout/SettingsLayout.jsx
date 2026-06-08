// E3-a — settings area layout (TopBar + settings sidebar + outlet)
// E5-a — added superadmin master-data route guard
// E6-responsive — sidebar jadi drawer pada mobile

import { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import TopBar from './TopBar.jsx';
import SettingsSidebar from './SettingsSidebar.jsx';
import ResponsiveDrawer from './ResponsiveDrawer.jsx';
import { useAuthStore } from '../../store/authStore.js';

function SettingsRoleGuard() {
  const location = useLocation();
  const isAgencyAdmin = useAuthStore((s) => s.isAgencyAdmin());
  const isSuperadmin = useAuthStore((s) => s.isSuperadmin());

  const adminPaths = [
    '/settings/agency',
    '/settings/devices',
    '/settings/sites',
    '/settings/boundaries',
    '/settings/users',
  ];
  const superadminPaths = [
    '/settings/device-types',
    '/settings/sensors',
  ];

  if (!isAgencyAdmin && adminPaths.some((p) => location.pathname.startsWith(p))) {
    return <Navigate to="/settings/account" replace />;
  }
  if (!isSuperadmin && superadminPaths.some((p) => location.pathname.startsWith(p))) {
    return <Navigate to="/settings/account" replace />;
  }

  return <Outlet />;
}

export default function SettingsLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = () => setDrawerOpen(false);

  return (
    <div className="h-full flex flex-col">
      <TopBar onMenuClick={() => setDrawerOpen(true)} />
      <div className="flex-1 flex overflow-hidden">
        <ResponsiveDrawer open={drawerOpen} onClose={closeDrawer}>
          <SettingsSidebar onNavigate={closeDrawer} />
        </ResponsiveDrawer>
        <main className="flex-1 relative overflow-hidden bg-slate-50">
          <SettingsRoleGuard />
        </main>
      </div>
    </div>
  );
}
