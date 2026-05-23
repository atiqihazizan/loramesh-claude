// src/components/layout/TopBar.jsx
// Bar atas nipis — nama produk, agency, profil user.
// E3-nav — Map / History / Settings dalam dropdown profil (selaras MapTopOverlay).

import { useState, useRef, useEffect } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import {
  ChevronDown,
  LogOut,
  User,
  Map,
  History,
  Settings,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore.js';
import AppLogo from '../ui/AppLogo.jsx';

const navItems = [
  { to: '/', icon: Map, label: 'Map', end: true },
  { to: '/historical', icon: History, label: 'History' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function TopBar() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const items = navItems;

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center
                       justify-between px-4 z-30">
      {/* Kiri — logo + nama */}
      <div className="flex items-center gap-2.5">
        <AppLogo className="h-8 w-auto max-h-8 object-contain" />
        <span className="font-semibold text-slate-800 hidden sm:inline">LoRa Mesh</span>
      </div>

      {/* Kanan — agency + profil */}
      <div className="flex items-center gap-4">
        {user?.agency && (
          <span className="text-sm text-slate-500 hidden sm:block">
            {user.agency.name}
          </span>
        )}

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5
                       hover:bg-slate-50 transition-colors"
          >
            <div className="h-7 w-7 rounded-full bg-brand-100 flex items-center
                            justify-center">
              <User size={15} className="text-brand-700" />
            </div>
            <span className="text-sm font-medium text-slate-700 hidden sm:block">
              {user?.name || user?.username}
            </span>
            <ChevronDown size={15} className="text-slate-400" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1 w-48 card py-1 shadow-panel overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="text-sm font-medium text-slate-800">
                  {user?.name || user?.username}
                </p>
                <p className="text-xs text-slate-400">{user?.level?.name}</p>
              </div>

              <div className="border-b border-slate-100 py-1">
                {items.map(({ to, icon: Icon, label, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      'flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors ' +
                      (isActive
                        ? 'bg-brand-50 font-medium text-brand-700'
                        : 'text-slate-700 hover:bg-slate-50')
                    }
                  >
                    <Icon size={15} className="shrink-0" />
                    {label}
                  </NavLink>
                ))}
              </div>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm
                           text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={15} />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
