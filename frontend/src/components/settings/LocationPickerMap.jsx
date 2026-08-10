// Location picker map — embedded MapLibre picker for forms
// (click / drag marker / Nominatim search → lat,lng strings)

import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Map, { Marker, useMap } from 'react-map-gl/maplibre';
import { Layers, Search } from 'lucide-react';
import { api } from '../../lib/api.js';
import { buildMapStyle } from '../../lib/mapStyle.js';
import { parseLatLng, FALLBACK_CENTER, FALLBACK_ZOOM } from '../../lib/mapConfig.js';

const FALLBACK_TILES = [
  { name: 'Roadmap',   url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}' },
  { name: 'Satellite', url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}' },
];

async function fetchTiles() {
  const res = await api.get('/tiles');
  return res.data?.tiles || [];
}

// Nominatim with Malaysia viewbox preference (bounded=0 → still shows outside MY)
async function searchPlace(q) {
  const params = new URLSearchParams({
    q,
    format: 'json',
    limit: '8',
    viewbox: '99.5,1.0,119.5,7.5', // Malaysia bounding box
    bounded: '0',
    addressdetails: '0',
  });
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { headers: { 'Accept-Language': 'ms,en', 'User-Agent': 'LoRaMesh/1.0' } }
  );
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

function toCoord(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmt(v) {
  return Number(v).toFixed(6);
}

function FlyTo({ target }) {
  const { current } = useMap();
  const lastNonce = useRef(null);
  useEffect(() => {
    if (!current || !target) return;
    if (target.nonce === lastNonce.current) return;
    lastNonce.current = target.nonce;
    current.flyTo({ center: target.center, zoom: target.zoom ?? 16, duration: 800 });
  }, [current, target]);
  return null;
}

export default function LocationPickerMap({ lat, lng, onChange, agencyCenter = null }) {
  const tilesQuery = useQuery({
    queryKey: ['tiles'],
    queryFn: fetchTiles,
    staleTime: 5 * 60 * 1000,
  });

  // Resolve Roadmap + Satellite tiles from DB, fallback to hardcoded Google
  const pickerTiles = useMemo(() => {
    const db = tilesQuery.data ?? [];
    const roadmap  = db.find((t) => t.name === 'Roadmap')   ?? FALLBACK_TILES[0];
    const satellite = db.find((t) => t.name === 'Satellite') ?? FALLBACK_TILES[1];
    return [roadmap, satellite];
  }, [tilesQuery.data]);

  const [tileIdx, setTileIdx] = useState(0); // 0 = Roadmap, 1 = Satellite

  const mapStyle = useMemo(
    () => buildMapStyle(pickerTiles[tileIdx]),
    [pickerTiles, tileIdx]
  );

  const latNum = toCoord(lat);
  const lngNum = toCoord(lng);
  const hasPos =
    latNum !== null && lngNum !== null &&
    latNum >= -90 && latNum <= 90 &&
    lngNum >= -180 && lngNum <= 180;

  const [initialView] = useState(() => {
    if (hasPos) return { longitude: lngNum, latitude: latNum, zoom: FALLBACK_ZOOM };
    const agencyParsed = parseLatLng(agencyCenter); // returns [lng, lat] or null
    return {
      longitude: agencyParsed?.[0] ?? FALLBACK_CENTER[0],
      latitude: agencyParsed?.[1] ?? FALLBACK_CENTER[1],
      zoom: FALLBACK_ZOOM,
    };
  });

  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [flyTarget, setFlyTarget] = useState(null);

  const pointerDown = useRef(null);
  const dragged = useRef(false);
  const flyNonce = useRef(0);

  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      searchPlace(search.trim())
        .then((data) => {
          if (cancelled) return;
          setResults(Array.isArray(data) ? data : []);
          setSearchError(null);
        })
        .catch(() => {
          if (!cancelled) setSearchError('Search failed');
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  const handleMapClick = (e) => {
    if (dragged.current) { dragged.current = false; return; }
    onChange(fmt(e.lngLat.lat), fmt(e.lngLat.lng));
  };

  const handleMarkerDragEnd = (e) => {
    onChange(fmt(e.lngLat.lat), fmt(e.lngLat.lng));
  };

  const pickResult = (r) => {
    const lngN = Number(r.lon);
    const latN = Number(r.lat);
    if (!Number.isFinite(lngN) || !Number.isFinite(latN)) return;
    onChange(fmt(latN), fmt(lngN));
    setFlyTarget({ nonce: ++flyNonce.current, center: [lngN, latN], zoom: 16 });
    setResults([]);
    setSearch('');
  };

  return (
    <div className="space-y-2">
      {/* Search */}
      <div className="relative">
        <div className="relative">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari tempat… (cth: Jalan Ampang, KL)"
            className="input pr-9"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            {searching ? (
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
            ) : (
              <Search size={15} />
            )}
          </span>
        </div>

        {results.length > 0 ? (
          <ul className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
            {results.map((r, i) => (
              <li key={`${r.place_id ?? i}`}>
                <button
                  type="button"
                  onClick={() => pickResult(r)}
                  className="block w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                >
                  {r.display_name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {searchError ? (
          <p className="mt-1 text-xs text-red-600">{searchError}</p>
        ) : null}
      </div>

      {/* Map */}
      <div className="relative h-[280px] overflow-hidden rounded-lg border border-slate-200">
        <Map
          id="location-picker"
          initialViewState={initialView}
          mapStyle={mapStyle}
          attributionControl={false}
          style={{ width: '100%', height: '100%' }}
          onMouseDown={(e) => {
            dragged.current = false;
            pointerDown.current = [e.originalEvent.clientX, e.originalEvent.clientY];
          }}
          onMouseMove={(e) => {
            if (!pointerDown.current) return;
            const [x0, y0] = pointerDown.current;
            if (Math.hypot(e.originalEvent.clientX - x0, e.originalEvent.clientY - y0) > 5)
              dragged.current = true;
          }}
          onMouseUp={() => { pointerDown.current = null; }}
          onClick={handleMapClick}
        >
          {hasPos ? (
            <Marker
              longitude={lngNum}
              latitude={latNum}
              anchor="bottom"
              draggable
              onDragEnd={handleMarkerDragEnd}
            >
              <div className="cursor-grab drop-shadow">
                <div className="h-4 w-4 rounded-full border-2 border-white bg-red-500" />
                <div className="mx-auto h-0 w-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-red-500" />
              </div>
            </Marker>
          ) : null}
          <FlyTo target={flyTarget} />
        </Map>

        {/* Tile switcher */}
        <div className="absolute bottom-2 left-2 flex overflow-hidden rounded-lg border border-slate-300 shadow-sm">
          {pickerTiles.map((t, i) => (
            <button
              key={t.name}
              type="button"
              onClick={() => setTileIdx(i)}
              className={
                'flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-colors ' +
                (tileIdx === i
                  ? 'bg-white text-slate-800'
                  : 'bg-black/30 text-white hover:bg-black/40')
              }
            >
              {i === 1 ? <Layers size={11} /> : null}
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Coordinate display */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="text-slate-400">Lat </span>
          <span className="font-medium">{hasPos ? fmt(latNum) : '—'}</span>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="text-slate-400">Lng </span>
          <span className="font-medium">{hasPos ? fmt(lngNum) : '—'}</span>
        </div>
      </div>
    </div>
  );
}
