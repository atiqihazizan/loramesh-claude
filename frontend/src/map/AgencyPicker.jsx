// src/map/AgencyPicker.jsx
// ----------------------------------------------------------------
// Pemilih agency — HANYA untuk superadmin.
//
// Dropdown dalam kad gabungan MapTopOverlay. Superadmin pilih
// agency → setSelectedAgencyId → useDevices muat semula device
// agency itu.
//
// Pengguna biasa: komponen ini render null (mereka terkunci pada
// agency sendiri; tiada pilihan untuk dibuat).
// ----------------------------------------------------------------

import { useState, useRef, useEffect } from 'react';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';
import { useAgencies } from '../hooks/useAgencies.js';
import { useMapContext } from './MapContext.jsx';

export default function AgencyPicker() {
  const isSuperadmin = useAuthStore((s) => s.isSuperadmin());
  const { agencies, isLoading } = useAgencies();
  const { selectedAgencyId, setSelectedAgencyId } = useMapContext();

  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Tutup dropdown bila klik luar.
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Pilih agency pertama secara automatik bila senarai sedia
  // dan belum ada pilihan.
  useEffect(() => {
    if (agencies.length > 0 && selectedAgencyId == null) {
      setSelectedAgencyId(agencies[0].id);
    }
  }, [agencies, selectedAgencyId, setSelectedAgencyId]);

  // Bukan superadmin — tiada pemilih.
  if (!isSuperadmin) return null;

  const selected = agencies.find((a) => a.id === selectedAgencyId);
  const label = isLoading
    ? 'Memuatkan…'
    : selected?.name || 'Pilih agensi';

  const handleSelect = (id) => {
    setSelectedAgencyId(id);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Tukar agensi"
        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5
                   text-sm transition-colors hover:bg-slate-100"
      >
        <Building2 size={16} className="shrink-0 text-slate-500" />
        <span className="max-w-[140px] truncate font-medium text-slate-700">
          {label}
        </span>
        <ChevronDown size={15} className="shrink-0 text-slate-400" />
      </button>

      {open && agencies.length > 0 && (
        <div
          className="absolute left-0 top-full mt-1.5 w-52 overflow-hidden
                     rounded-xl bg-white shadow-xl ring-1 ring-slate-200"
        >
          {agencies.map((agency) => {
            const isActive = agency.id === selectedAgencyId;
            return (
              <button
                key={agency.id}
                type="button"
                onClick={() => handleSelect(agency.id)}
                className={
                  'flex w-full items-center gap-2.5 px-3 py-2.5 text-sm ' +
                  'transition-colors ' +
                  (isActive
                    ? 'bg-blue-50 font-medium text-blue-700'
                    : 'text-slate-700 hover:bg-slate-50')
                }
              >
                <span className="flex-1 text-left">
                  <span className="block truncate">{agency.name}</span>
                  <span className="block text-xs text-slate-400">
                    {agency.code}
                  </span>
                </span>
                {isActive && (
                  <Check size={14} className="shrink-0 text-blue-600" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}