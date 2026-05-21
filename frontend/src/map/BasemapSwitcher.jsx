// src/map/BasemapSwitcher.jsx
// ----------------------------------------------------------------
// Kad terapung kanan-atas — tukar basemap aktif.
// Ikon Lucide dipilih ikut nama tile (bukan lajur `icon` DB —
// supaya tak bergantung pada nilai DB yang mungkin tak konsisten).
// ----------------------------------------------------------------

import { Map as MapIcon, Satellite, Mountain, Layers } from 'lucide-react';

// Padan nama tile → ikon Lucide.
const ICON_BY_NAME = {
  Roadmap: MapIcon,
  Satelit: Satellite,
  Terrain: Mountain,
};

/**
 * @param {object}   props
 * @param {Array}    props.tiles       senarai tiles /api/tiles
 * @param {object}   props.activeTile  tile aktif sekarang
 * @param {Function} props.onChange    (tile) => void
 */
export default function BasemapSwitcher({ tiles, activeTile, onChange }) {
  if (!Array.isArray(tiles) || tiles.length === 0) return null;

  return (
    <div className="absolute right-3 top-3 z-10">
      <div className="flex flex-col gap-1 rounded-xl bg-white/95 p-1.5 shadow-lg ring-1 ring-slate-200 backdrop-blur">
        {tiles.map((tile) => {
          const Icon = ICON_BY_NAME[tile.name] || Layers;
          const isActive = activeTile?.id === tile.id;

          return (
            <button
              key={tile.id}
              type="button"
              onClick={() => onChange(tile)}
              title={tile.name}
              className={
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ' +
                (isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-700 hover:bg-slate-100')
              }
            >
              <Icon size={16} strokeWidth={2} />
              <span>{tile.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}