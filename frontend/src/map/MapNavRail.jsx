// src/map/MapNavRail.jsx
// Rel navigasi terapung — versi OVERLAY untuk MapLayout.
//
// Kad ikon terapung di kiri-tengah, bukan jalur tetap. Kembang
// (tunjuk label) bila hover, sama gaya Sidebar E1 tapi sebagai
// pulau terapung dengan sudut bulat + bayang.

import { NavLink } from 'react-router-dom';
import { Map, History, Settings, Shield } from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';

const navItems = [
  { to: '/', icon: Map, label: 'Map', end: true },
  { to: '/historical', icon: History, label: 'History' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function MapNavRail() {
  const isSuperadmin = useAuthStore((s) => s.isSuperadmin());

  const items = [...navItems];
  if (isSuperadmin) {
    items.push({ to: '/admin', icon: Shield, label: 'Admin' });
  }

  return (
    <nav
      className="group absolute left-3 top-1/2 z-20 -translate-y-1/2
                 flex flex-col gap-1 rounded-2xl bg-white/95 p-1.5
                 shadow-lg ring-1 ring-slate-200 backdrop-blur
                 transition-all duration-200"
    >
      {items.map(({ to, icon: Icon, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          title={label}
          className={({ isActive }) =>
            'flex items-center gap-0 rounded-xl px-3 py-2.5 ' +
            'whitespace-nowrap transition-colors ' +
            (isActive
              ? 'bg-blue-600 text-white'
              : 'text-slate-500 hover:bg-slate-100')
          }
        >
          <Icon size={20} className="shrink-0" />
          {/* Label tersembunyi sehingga hover atas rel */}
          <span
            className="max-w-0 overflow-hidden text-sm font-medium
                       opacity-0 transition-all duration-200
                       group-hover:max-w-[120px] group-hover:opacity-100 group-hover:ml-2"
          >
            {label}
          </span>
        </NavLink>
      ))}
    </nav>
  );
}