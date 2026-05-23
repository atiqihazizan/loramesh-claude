// src/map/TypeFilter.jsx
// ----------------------------------------------------------------
// Penapis device type + pencari node — butang terapung kiri.
//
// Komponen OVERLAY — dirender oleh MapLayout, DI LUAR <Map>.
//
// Setiap type:
//   - header : titik warna + nama + bilangan + toggle mata
//              (sembunyi/papar marker — hiddenTypeCodes/toggleTypeCode)
//   - bawah  : senarai nama node. Tekan node → peta terbang ke
//              marker (zoom 19) + pilih device + tutup panel.
//
// flyTo + setSelectedDeviceId datang dari MapContext.
// ----------------------------------------------------------------

import { useState, useRef, useEffect, useMemo } from 'react';
import { SlidersHorizontal, Eye, EyeOff } from 'lucide-react';
import { useDevices } from '../hooks/useDevices.js';
import { useMapContext } from './MapContext.jsx';

// Kunci type bagi satu device.
// Medan dari /api/devices bernama `type` (bukan device_type).
function typeCodeOf(device) {
  return device.type?.code || '__none__';
}

export default function TypeFilter() {
  const { devices } = useDevices();
  const { hiddenTypeCodes, toggleTypeCode, flyTo, setSelectedDeviceId } =
    useMapContext();

  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Tutup dropdown bila klik di luar.
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Kumpulan type → senarai device, diisih ikut nama.
  const groups = useMemo(() => {
    const map = new Map();
    for (const d of devices) {
      const code = typeCodeOf(d);
      if (!map.has(code)) {
        map.set(code, {
          code,
          name: d.type?.name || 'No type',
          color_code: d.type?.color_code || '#808080',
          devices: [],
        });
      }
      map.get(code).devices.push(d);
    }
    for (const g of map.values()) {
      g.devices.sort((a, b) =>
        String(a.name || a.device_id).localeCompare(
          String(b.name || b.device_id),
        ),
      );
    }
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [devices]);

  // Tiada device — tiada penapis.
  if (groups.length === 0) return null;

  const hiddenCount = hiddenTypeCodes.size;

  // Tekan nama node → terbang ke marker + pilih device + tutup panel.
  const handleNodeClick = (d) => {
    if (typeof d.latitude !== 'number' || typeof d.longitude !== 'number') {
      return;
    }
    flyTo(d.longitude, d.latitude, 19);
    setSelectedDeviceId(d.device_id);
    setOpen(false);
  };

  return (
    <div className="absolute left-3 top-[70px] z-20" ref={ref}>
      {/* Butang pencetus */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Filter & cari device"
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
          Type{hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ''}
        </span>
      </button>

      {/* Dropdown — kumpulan type + senarai node */}
      {open && (
        <div
          className="mt-2 w-64 max-h-[70vh] overflow-y-auto rounded-xl
                     bg-white shadow-xl ring-1 ring-slate-200"
        >
          {groups.map((g) => {
            const isHidden = hiddenTypeCodes.has(g.code);
            return (
              <div
                key={g.code}
                className="border-b border-slate-100 last:border-b-0"
              >
                {/* Header type — toggle sembunyi/papar */}
                <div className="flex items-center gap-2 px-3 py-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: g.color_code }}
                  />
                  <span className="flex-1 truncate text-sm font-semibold text-slate-700">
                    {g.name}
                  </span>
                  <span className="text-xs text-slate-400">
                    {g.devices.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleTypeCode(g.code)}
                    title={isHidden ? 'Tunjuk type ini' : 'Sembunyi type ini'}
                    className="flex h-6 w-6 items-center justify-center
                               rounded text-slate-400 transition-colors
                               hover:bg-slate-100 hover:text-slate-600"
                  >
                    {isHidden ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                {/* Senarai node — dimkan & matikan bila type disembunyi */}
                <div
                  className={
                    'pb-1 ' +
                    (isHidden ? 'pointer-events-none opacity-40' : '')
                  }
                >
                  {g.devices.map((d) => {
                    const hasCoords =
                      typeof d.latitude === 'number' &&
                      typeof d.longitude === 'number';
                    return (
                      <button
                        key={d.device_id}
                        type="button"
                        disabled={!hasCoords}
                        onClick={() => handleNodeClick(d)}
                        title={hasCoords ? 'Pergi ke marker' : 'Tiada koordinat'}
                        className={
                          'flex w-full items-center px-3 py-1.5 pl-7 ' +
                          'text-left text-sm transition-colors ' +
                          (hasCoords
                            ? 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                            : 'cursor-not-allowed text-slate-300')
                        }
                      >
                        <span className="truncate">
                          {d.name || d.device_id}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
