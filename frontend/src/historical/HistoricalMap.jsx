// E4-c — historical route map. Own MapLibre instance (no live socket).
// Draws the track as a GeoJSON line + start/end markers.

import { useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import Map, { Source, Layer, Marker, useMap } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { api } from '../lib/api.js';
import { buildMapStyle } from '../lib/mapStyle.js';
import { FALLBACK_CENTER, FALLBACK_ZOOM } from '../lib/mapConfig.js';

async function fetchTiles() {
  const res = await api.get('/tiles');
  return res.data?.tiles || [];
}

// Keep only points with valid coordinates, in order.
function validPoints(points) {
  if (!Array.isArray(points)) return [];
  return points.filter(
    (p) =>
      typeof p.latitude === 'number' &&
      typeof p.longitude === 'number' &&
      Number.isFinite(p.latitude) &&
      Number.isFinite(p.longitude)
  );
}

// Fit the map to the track once it is loaded.
function FitBounds({ points }) {
  const { current: map } = useMap();
  useEffect(() => {
    if (!map || points.length === 0) return;
    let minLng = points[0].longitude;
    let maxLng = points[0].longitude;
    let minLat = points[0].latitude;
    let maxLat = points[0].latitude;
    for (const p of points) {
      minLng = Math.min(minLng, p.longitude);
      maxLng = Math.max(maxLng, p.longitude);
      minLat = Math.min(minLat, p.latitude);
      maxLat = Math.max(maxLat, p.latitude);
    }
    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: 60, duration: 800, maxZoom: 17 }
    );
  }, [map, points]);
  return null;
}

/**
 * @param {object} props
 * @param {Array} props.points  track points (latitude/longitude/...)
 */
export default function HistoricalMap({ points }) {
  const tilesQuery = useQuery({
    queryKey: ['tiles'],
    queryFn: fetchTiles,
    staleTime: 5 * 60 * 1000,
  });

  const pts = useMemo(() => validPoints(points), [points]);

  const mapStyle = useMemo(() => {
    const tile = tilesQuery.data?.[0] || null;
    return buildMapStyle(tile);
  }, [tilesQuery.data]);

  const lineGeoJSON = useMemo(
    () => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: pts.map((p) => [p.longitude, p.latitude]),
      },
    }),
    [pts]
  );

  const initialViewState = useMemo(
    () => ({
      longitude: pts[0]?.longitude ?? FALLBACK_CENTER[0],
      latitude: pts[0]?.latitude ?? FALLBACK_CENTER[1],
      zoom: pts.length > 0 ? 14 : FALLBACK_ZOOM,
    }),
    [pts]
  );

  if (!mapStyle) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100">
        <p className="text-slate-500 text-sm">Preparing map…</p>
      </div>
    );
  }

  const start = pts[0];
  const end = pts[pts.length - 1];

  return (
    <Map
      initialViewState={initialViewState}
      mapStyle={mapStyle}
      attributionControl={{ compact: true }}
      style={{ width: '100%', height: '100%' }}
    >
      {pts.length >= 2 ? (
        <Source id="track" type="geojson" data={lineGeoJSON}>
          <Layer
            id="track-line"
            type="line"
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{ 'line-color': '#2563eb', 'line-width': 4 }}
          />
        </Source>
      ) : null}

      {start ? (
        <Marker
          longitude={start.longitude}
          latitude={start.latitude}
          anchor="bottom"
        >
          <div className="flex flex-col items-center">
            <span className="rounded bg-green-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
              START
            </span>
            <span className="h-2 w-2 rounded-full bg-green-600 border border-white" />
          </div>
        </Marker>
      ) : null}

      {end && pts.length >= 2 ? (
        <Marker longitude={end.longitude} latitude={end.latitude} anchor="bottom">
          <div className="flex flex-col items-center">
            <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
              END
            </span>
            <span className="h-2 w-2 rounded-full bg-red-600 border border-white" />
          </div>
        </Marker>
      ) : null}

      <FitBounds points={pts} />
    </Map>
  );
}
