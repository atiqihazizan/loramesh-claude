// src/map/BasemapSwitcher.jsx
// ----------------------------------------------------------------
// E2-shell-fix: butang ikon tunggal — klik buka senarai basemap.
//
// Bukan lagi tiga butang sentiasa nampak. Ikon = basemap aktif;
// klik → dropdown tiga pilihan keluar ke bawah.
//
// Dimaksudkan untuk diletak DALAM kad gabungan MapTopOverlay,
// bersebelahan menu profil. Data tile dibaca dari MapContext.
// ----------------------------------------------------------------

import { useState, useRef, useEffect } from 'react';
import { Map as MapIcon, Satellite, Mountain, Layers, Check } from 'lucide-react';
import { useMapContext } from './MapContext.jsx';

// Padan nama tile → ikon Lucide.
const ICON_BY_NAME = {
  Roadmap: MapIcon,
  Satelit: Satellite,
  Terrain: Mountain,
};

export default function BasemapSwitcher() {
  const { tiles, activeTile, setActiveTile } = useMapContext();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Tutup dropdown bila klik di luar.
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!Array.isArray(tiles) || tiles.length === 0) return null;

  const ActiveIcon = ICON_BY_NAME[activeTile?.name] || Layers;

  const handleSelect = (tile) => {
    setActiveTile(tile);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      {/* Butang ikon — tunjuk basemap aktif */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={`Basemap: ${activeTile?.name || '—'}`}
        className="flex h-9 w-9 items-center justify-center rounded-lg
                   text-slate-600 transition-colors hover:bg-slate-100"
      >
        <ActiveIcon size={18} strokeWidth={2} />
      </button>

      {/* Dropdown senarai basemap */}
      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 w-40 overflow-hidden
                     rounded-xl bg-white shadow-xl ring-1 ring-slate-200"
        >
          {tiles.map((tile) => {
            const Icon = ICON_BY_NAME[tile.name] || Layers;
            const isActive = activeTile?.id === tile.id;
            return (
              <button
                key={tile.id}
                type="button"
                onClick={() => handleSelect(tile)}
                className={
                  'flex w-full items-center gap-2.5 px-3 py-2.5 text-sm ' +
                  'transition-colors ' +
                  (isActive
                    ? 'bg-blue-50 font-medium text-blue-700'
                    : 'text-slate-700 hover:bg-slate-50')
                }
              >
                <Icon size={16} strokeWidth={2} className="shrink-0" />
                <span className="flex-1 text-left">{tile.name}</span>
                {isActive && <Check size={14} className="text-blue-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}