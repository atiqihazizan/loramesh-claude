// src/components/layout/Sidebar.jsx
// Sidebar ikon nipis di kiri. Kembang bila hover.

import { NavLink } from 'react-router-dom';
import { Map, History, Settings, Shield } from 'lucide-react';
import { useAuthStore } from '../../store/authStore.js';

const navItems = [
  { to: '/', icon: Map, label: 'Peta', end: true },
  { to: '/historical', icon: History, label: 'Sejarah' },
  { to: '/settings', icon: Settings, label: 'Tetapan' },
];

export default function Sidebar() {
  const isSuperadmin = useAuthStore((s) => s.isSuperadmin());

  const items = [...navItems];
  if (isSuperadmin) {
    items.push({ to: '/admin', icon: Shield, label: 'Admin' });
  }

  return (
    <aside className="group w-14 hover:w-48 transition-all duration-200
                       bg-white border-r border-slate-200 flex flex-col
                       py-3 z-20 overflow-hidden">
      {items.map(({ to, icon: Icon, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 mx-2 rounded-lg
             transition-colors whitespace-nowrap ${
               isActive
                 ? 'bg-brand-50 text-brand-700'
                 : 'text-slate-500 hover:bg-slate-50'
             }`
          }
        >
          <Icon size={20} className="shrink-0" />
          <span className="text-sm font-medium opacity-0 group-hover:opacity-100
                           transition-opacity">
            {label}
          </span>
        </NavLink>
      ))}
    </aside>
  );
}
