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
import { Radio, ChevronDown, LogOut, User } from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';
import AgencyPicker from './AgencyPicker.jsx';
import BasemapSwitcher from './BasemapSwitcher.jsx';

export default function MapTopOverlay() {
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

  return (
    <>
      {/* Kepingan kiri — logo + nama produk */}
      <div
        className="absolute left-3 top-3 z-20 flex items-center gap-2.5
                   rounded-xl bg-white/95 px-3 py-2 shadow-lg
                   ring-1 ring-slate-200 backdrop-blur"
      >
        <div className="flex h-7 w-7 items-center justify-center
                        rounded-lg bg-blue-600">
          <Radio size={16} className="text-white" />
        </div>
        <span className="font-semibold text-slate-800">LoRa Mesh</span>
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
                {user?.name || user?.username || 'Pengguna'}
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
                    <p className="text-xs text-slate-400">Agensi</p>
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
                  Log keluar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}