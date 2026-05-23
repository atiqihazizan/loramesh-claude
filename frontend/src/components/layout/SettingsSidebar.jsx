// E3-a — settings sidebar: settings sub-nav (role-gated)
// E5-a — added superadmin master-data links (Sensors, Device Types)
// E6-responsive — onNavigate: tutup drawer mobile bila pilih item

import { NavLink } from 'react-router-dom';
import {
  Building2,
  Cpu,
  Gauge,
  MapPinned,
  Shapes,
  UserCircle,
  Users,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore.js';

const settingsLinkClass = ({ isActive }) =>
  `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg transition-colors whitespace-nowrap ${
    isActive
      ? 'bg-brand-50 text-brand-700'
      : 'text-slate-600 hover:bg-slate-100'
  }`;

export default function SettingsSidebar({ onNavigate }) {
  const isAgencyAdmin = useAuthStore((s) => s.isAgencyAdmin());
  const isSuperadmin = useAuthStore((s) => s.isSuperadmin());

  return (
    <aside
      className="w-52 h-full shrink-0 bg-white border-r border-slate-200 flex flex-col py-4 overflow-y-auto"
      aria-label="Settings navigation"
    >
      <p className="px-4 mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Settings
      </p>
      {isAgencyAdmin ? (
        <>
          <NavLink to="/settings/agency" onClick={onNavigate} className={settingsLinkClass}>
            <Building2 size={18} className="shrink-0" />
            <span className="text-sm font-medium">Agency Settings</span>
          </NavLink>
          <NavLink to="/settings/devices" onClick={onNavigate} className={settingsLinkClass}>
            <Cpu size={18} className="shrink-0" />
            <span className="text-sm font-medium">Devices</span>
          </NavLink>
          <NavLink to="/settings/sites" onClick={onNavigate} className={settingsLinkClass}>
            <MapPinned size={18} className="shrink-0" />
            <span className="text-sm font-medium">Sites</span>
          </NavLink>
          <NavLink to="/settings/users" onClick={onNavigate} className={settingsLinkClass}>
            <Users size={18} className="shrink-0" />
            <span className="text-sm font-medium">Users</span>
          </NavLink>
        </>
      ) : null}
      <NavLink to="/settings/account" onClick={onNavigate} className={settingsLinkClass}>
        <UserCircle size={18} className="shrink-0" />
        <span className="text-sm font-medium">My Account</span>
      </NavLink>

      {isSuperadmin ? (
        <>
          <hr className="my-4 mx-4 border-slate-200" />
          <p className="px-4 mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Master data
          </p>
          <NavLink to="/settings/agencies" onClick={onNavigate} className={settingsLinkClass}>
            <Building2 size={18} className="shrink-0" />
            <span className="text-sm font-medium">Agencies</span>
          </NavLink>
          <NavLink to="/settings/sensors" onClick={onNavigate} className={settingsLinkClass}>
            <Gauge size={18} className="shrink-0" />
            <span className="text-sm font-medium">Sensors</span>
          </NavLink>
          <NavLink to="/settings/device-types" onClick={onNavigate} className={settingsLinkClass}>
            <Shapes size={18} className="shrink-0" />
            <span className="text-sm font-medium">Device Types</span>
          </NavLink>
        </>
      ) : null}
    </aside>
  );
}
