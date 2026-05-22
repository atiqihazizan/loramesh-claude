// E3-a — settings area layout (TopBar + settings sidebar + outlet)

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import TopBar from './TopBar.jsx';
import SettingsSidebar from './SettingsSidebar.jsx';
import { useAuthStore } from '../../store/authStore.js';

function SettingsRoleGuard() {
  const location = useLocation();
  const isAgencyAdmin = useAuthStore((s) => s.isAgencyAdmin());
  const adminPaths = ['/settings/agency', '/settings/users'];

  if (!isAgencyAdmin && adminPaths.some((p) => location.pathname.startsWith(p))) {
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
