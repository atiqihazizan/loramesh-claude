// Location picker map — embbedded MapLibre picker for forms
// (click / drag marker / Nominatim search → lat,lng strings)

import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Map, { Marker, useMap } from 'react-map-gl/maplibre';
import { Search } from 'lucide-react';
import { api } from '../../lib/api.js';
import { buildMapStyle } from '../../lib/mapStyle.js';
import { FALLBACK_CENTER, FALLBACK_ZOOM } from '../../lib/mapConfig.js';

const FALLBACK_TILE_URL = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

async function fetchTiles() {
  const res = await api.get('/tiles');
  return res.data?.tiles || [];
}

async function searchPlace(q) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`,
    { headers: { 'Accept-Language': 'en', 'User-Agent': 'LoRaMesh/1.0' } }
  );
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

function toCoord(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
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

/**
 * @param {object} props
 * @param {string} props.lat        latitude string (may be empty)
 * @param {string} props.lng        longitude string (may be empty)
 * @param {(lat: string, lng: string) => void} props.onChange
 */
export default function LocationPickerMap({ lat, lng, onChange }) {
  const tilesQuery = useQuery({
    queryKey: ['tiles'],
    queryFn: fetchTiles,
    staleTime: 5 * 60 * 1000,
  });

  const mapStyle = useMemo(() => {
    const tile = tilesQuery.data?.[0] ?? null;
    if (tile) return buildMapStyle(tile);
    return buildMapStyle({ url: FALLBACK_TILE_URL, name: 'Fallback' });
  }, [tilesQuery.data]);

  const latNum = toCoord(lat);
  const lngNum = toCoord(lng);
  const hasPos =
    latNum !== null && lngNum !== null && latNum >= -90 && latNum <= 90 && lngNum >= -180 && lngNum <= 180;

  const [initialView] = useState(() => ({
    longitude: hasPos ? lngNum : FALLBACK_CENTER[0],
    latitude: hasPos ? latNum : FALLBACK_CENTER[1],
    zoom: FALLBACK_ZOOM,
  }));

  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [flyTarget, setFlyTarget] = useState(null);

  const pointerDown = useRef(null);
  const dragged = useRef(false);
  const flyNonce = useRef(0);

  useEffect(() => {
    if (!search.trim()) return;
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
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    onChange(fmt(e.lngLat.lat), fmt(e.lngLat.lng));
  };

  const handleMarkerDragEnd = (e) => {
    onChange(fmt(e.lngLat.lat), fmt(e.lngLat.lng));
  };

  const pickResult = (r) => {
    const [lngN, latN] = [Number(r.lon), Number(r.lat)];
    if (!Number.isFinite(lngN) || !Number.isFinite(latN)) return;
    onChange(fmt(latN), fmt(lngN));
    setFlyTarget({ nonce: ++flyNonce.current, center: [lngN, latN], zoom: 16 });
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <form
          onSubmit={(e) => {
            e.preventDefault();
          }}
          className="relative"
        >
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search place (Nominatim)"
            className="input pr-9"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            {searching && search.trim() ? (
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
            ) : (
              <Search size={15} />
            )}
          </span>
        </form>

        {search.trim() && results.length > 0 ? (
          <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
            {results.map((r, i) => (
              <li key={`${r.display_name}-${i}`}>
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

        {search.trim() && searchError ? (
          <p className="mt-1 text-xs text-red-600">{searchError}</p>
        ) : null}
      </div>

      <div className="relative h-[280px] overflow-hidden rounded-lg border border-slate-200">
        <Map
          id="location-picker"
          initialViewState={initialView}
          mapStyle={mapStyle}
          attributionControl={false}
          style={{ width: '100%', height: '100%' }}
          onMouseDown={(e) => {
            dragged.current = false;
            pointerDown.current = [
              e.originalEvent.clientX,
              e.originalEvent.clientY,
            ];
          }}
          onMouseMove={(e) => {
            if (!pointerDown.current) return;
            const [x0, y0] = pointerDown.current;
            const dx = e.originalEvent.clientX - x0;
            const dy = e.originalEvent.clientY - y0;
            if (Math.hypot(dx, dy) > 5) dragged.current = true;
          }}
          onMouseUp={() => {
            pointerDown.current = null;
          }}
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
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="text-slate-400">Lat</span>{' '}
          <span className="font-medium">{hasPos ? fmt(latNum) : '—'}</span>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="text-slate-400">Lng</span>{' '}
          <span className="font-medium">{hasPos ? fmt(lngNum) : '—'}</span>
        </div>
      </div>
    </div>
  );
}