// src/map/TypeFilter.jsx
// ----------------------------------------------------------------
// Penapis device type — butang terapung kiri (dekat MapNavRail).
//
// Komponen OVERLAY — dirender oleh MapLayout, DI LUAR <Map>.
// (Bukan elemen peta seperti Marker/Popup.)
//
// Senarai type dikira sendiri dari useDevices (device agency
// semasa). Set type tersembunyi dibaca/ditulis melalui MapContext
// (hiddenTypeCodes / toggleTypeCode) — dikongsi dengan DeviceLayer
// yang menapis marker.
//
// Semua type dicentang (view) secara lalai; nyahcentang → sembunyi.
// ----------------------------------------------------------------

import { useState, useRef, useEffect, useMemo } from 'react';
import { SlidersHorizontal, Check } from 'lucide-react';
import { useDevices } from '../hooks/useDevices.js';
import { useMapContext } from './MapContext.jsx';

// Kunci type bagi satu device.
// Medan dari /api/devices bernama `type` (bukan device_type).
function typeCodeOf(device) {
  return device.type?.code || device.data_type || '__none__';
}

export default function TypeFilter() {
  const { devices } = useDevices();
  const { hiddenTypeCodes, toggleTypeCode } = useMapContext();

  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Senarai type unik dari device semasa.
  const types = useMemo(() => {
    const map = new Map();
    for (const d of devices) {
      const code = typeCodeOf(d);
      if (!map.has(code)) {
        map.set(code, {
          code,
          name: d.type?.name || d.data_type || 'No type',
          color_code: d.type?.color_code || '#808080',
        });
      }
    }
    return Array.from(map.values());
  }, [devices]);

  // Tiada type — tiada penapis.
  if (types.length === 0) return null;

  const hiddenCount = hiddenTypeCodes.size;

  return (
    <div className="absolute left-3 top-[70px] z-20" ref={ref}>
      {/* Butang pencetus */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Filter device types"
        className={
          'flex h-9 items-center gap-2 rounded-xl px-3 shadow-lg ' +
          'ring-1 backdrop-blur transition-colors ' +
          (hiddenCount > 0
            ? 'bg-blue-600 text-white ring-blue-600'
            : 'bg-white/95 text-slate-600 ring-slate-200 hover:bg-slate-100')
        }
      >
        <SlidersHorizontal size={16} />
        <span className="text-sm font-medium">
          Type
          {hiddenCount > 0
            ? ` (${types.length - hiddenCount}/${types.length})`
            : ''}
        </span>
      </button>

      {/* Dropdown senarai type */}
      {open && (
        <div
          className="absolute left-0 top-full mt-1.5 w-52 overflow-hidden
                     rounded-xl bg-white shadow-xl ring-1 ring-slate-200"
        >
          {types.map((t) => {
            const isVisible = !hiddenTypeCodes.has(t.code);
            return (
              <button
                key={t.code}
                type="button"
                onClick={() => toggleTypeCode(t.code)}
                className="flex w-full items-center gap-2.5 px-3 py-2.5
                           text-sm text-slate-700 transition-colors
                           hover:bg-slate-50"
              >
                {/* Kotak semak */}
                <span
                  className={
                    'flex h-4 w-4 shrink-0 items-center justify-center ' +
                    'rounded border ' +
                    (isVisible
                      ? 'border-blue-600 bg-blue-600'
                      : 'border-slate-300 bg-white')
                  }
                >
                  {isVisible && <Check size={11} className="text-white" />}
                </span>

                {/* Titik warna type */}
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '9999px',
                    backgroundColor: t.color_code,
                    display: 'inline-block',
                  }}
                />

                <span className="flex-1 text-left">{t.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}