// E3-a — settings area layout (TopBar + settings sidebar + outlet)
// E5-a — added superadmin master-data route guard

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import TopBar from './TopBar.jsx';
import SettingsSidebar from './SettingsSidebar.jsx';
import { useAuthStore } from '../../store/authStore.js';

function SettingsRoleGuard() {
  const location = useLocation();
  const isAgencyAdmin = useAuthStore((s) => s.isAgencyAdmin());
  const isSuperadmin = useAuthStore((s) => s.isSuperadmin());

  const adminPaths = [
    '/settings/agency',
    '/settings/devices',
    '/settings/sites',
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
  return (
    <div className="h-full flex flex-col">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <SettingsSidebar />
        <main className="flex-1 relative overflow-hidden bg-slate-50">
          <SettingsRoleGuard />
        </main>
      </div>
    </div>
  );
}
