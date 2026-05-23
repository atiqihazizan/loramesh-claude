// src/map/MapTopOverlay.jsx
// ----------------------------------------------------------------
// Overlay atas peta — versi terapung TopBar E1.
//
// E2-shell-fix: kepingan kanan kini KAD GABUNGAN —
//   [ butang basemap ] | [ menu profil ]
// dalam satu kad putih. Tiada lagi tindihan dengan BasemapSwitcher
// (yang dulu kad berasingan kanan-atas).
//
// Susun atur terapung peta:
//   kiri-atas   : logo + nama
//   kanan-atas  : kad [basemap | profil]
//   kiri-tengah : MapNavRail
//   kanan-bawah : kawalan zoom (+ PTZ nanti)
//   kiri-bawah  : bar skala
// ----------------------------------------------------------------

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, User } from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';
import AppLogo from '../components/ui/AppLogo.jsx';
import AgencyPicker from './AgencyPicker.jsx';
import BasemapSwitcher from './BasemapSwitcher.jsx';

function agencyDisplayLabel(agency) {
  if (!agency?.name) return null;
  if (agency.code) return `${agency.name} (${agency.code})`;
  return agency.name;
}

export default function MapTopOverlay() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isSuperadmin = useAuthStore((s) => s.isSuperadmin());
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

  return (
    <>
      {/* Kepingan kiri — logo + nama produk */}
      <div
        className="absolute left-3 top-3 z-20 flex items-center gap-2.5
                   rounded-xl bg-white/95 px-3 py-3 shadow-lg
                   ring-1 ring-slate-200 backdrop-blur"
      >
        <AppLogo className="h-7 w-auto max-h-7 object-contain" />
        <span className="font-semibold text-slate-800 hidden sm:inline">LoRa Mesh</span>
        {/* E3-g — read-only agency label for non-superadmin (superadmin uses AgencyPicker) */}
        {!isSuperadmin && user?.agency ? (
          <>
            <span
              className="h-4 w-px bg-slate-200 shrink-0"
              aria-hidden
            />
            <span
              className="text-xs text-slate-500 max-w-[11rem] truncate"
              title={agencyDisplayLabel(user.agency)}
            >
              {agencyDisplayLabel(user.agency)}
            </span>
          </>
        ) : null}
      </div>

      {/* Kepingan kanan — KAD GABUNGAN: agency | basemap | profil */}
      <div className="absolute right-3 top-3 z-20">
        <div
          className="flex items-center gap-1 rounded-xl bg-white/95 p-1
                     shadow-lg ring-1 ring-slate-200 backdrop-blur"
        >
          {/* Pemilih agency — render null jika bukan superadmin */}
          <AgencyPicker />

          {/* Butang basemap — buka dropdown sendiri */}
          <BasemapSwitcher />

          {/* Pemisah nipis */}
          <div className="h-6 w-px bg-slate-200" />

          {/* Menu profil */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5
                         transition-colors hover:bg-slate-100"
            >
              <div className="flex h-7 w-7 items-center justify-center
                              rounded-full bg-blue-100">
                <User size={15} className="text-blue-700" />
              </div>
              <span className="hidden text-sm font-medium text-slate-700 sm:block">
                {user?.name || user?.username || 'User'}
              </span>
              <ChevronDown size={15} className="text-slate-400" />
            </button>

            {/* Dropdown profil */}
            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 w-44
                           overflow-hidden rounded-xl bg-white shadow-xl
                           ring-1 ring-slate-200"
              >
                {/* Nama agency — papar dalam dropdown */}
                {user?.agency && (
                  <div className="border-b border-slate-100 px-4 py-2.5">
                    <p className="text-xs text-slate-400">Agency</p>
                    <p className="text-sm font-medium text-slate-700">
                      {user.agency.name}
                    </p>
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5
                             text-sm text-slate-700 transition-colors
                             hover:bg-slate-50"
                >
                  <LogOut size={15} className="text-slate-400" />
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}