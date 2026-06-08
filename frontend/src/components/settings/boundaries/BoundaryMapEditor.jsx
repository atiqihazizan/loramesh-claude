// Map editor for boundaries — view all, draw new polygon, edit single Polygon.

import { useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import Map, { Source, Layer, Marker, useMap } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { api } from '../../../lib/api.js';
import { buildMapStyle } from '../../../lib/mapStyle.js';
import { FALLBACK_CENTER, FALLBACK_ZOOM } from '../../../lib/mapConfig.js';

async function fetchTiles() {
  const res = await api.get('/tiles');
  return res.data?.tiles || [];
}

function featureCollection(features) {
  return { type: 'FeatureCollection', features: features.filter(Boolean) };
}

function buildDraftFeature(points) {
  if (points.length < 2) {
    if (points.length === 1) {
      return {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: points },
      };
    }
    return null;
  }
  const ring = [...points];
  if (ring.length >= 3) {
    const a = ring[0];
    const b = ring[ring.length - 1];
    if (a[0] !== b[0] || a[1] !== b[1]) ring.push([...a]);
  }
  if (ring.length >= 4) {
    return {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [ring] },
    };
  }
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: points },
  };
}

function boundsFromFeatures(features) {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  const visit = (lng, lat) => {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  };

  const walkCoords = (coords, depth) => {
    if (depth === 0) visit(coords[0], coords[1]);
    else coords.forEach((c) => walkCoords(c, depth - 1));
  };

  for (const f of features) {
    const g = f?.geometry;
    if (!g) continue;
    if (g.type === 'Point') visit(g.coordinates[0], g.coordinates[1]);
    else if (g.type === 'LineString') g.coordinates.forEach(([lng, lat]) => visit(lng, lat));
    else if (g.type === 'Polygon') walkCoords(g.coordinates, 2);
    else if (g.type === 'MultiPolygon') walkCoords(g.coordinates, 3);
  }

  if (!Number.isFinite(minLng)) return null;
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

function FlyToController({ target }) {
  const { current: map } = useMap();
  const lastNonce = useRef(null);

  useEffect(() => {
    if (!map || !target) return;
    if (target.nonce === lastNonce.current) return;
    lastNonce.current = target.nonce;

    const bounds = boundsFromFeatures([target.feature]);
    if (bounds) {
      map.fitBounds(bounds, { padding: 48, duration: 800, maxZoom: 18 });
      return;
    }
    map.flyTo({ center: FALLBACK_CENTER, zoom: 18, duration: 800 });
  }, [map, target]);

  return null;
}

function FitOnModeChange({ features, modeKey }) {
  const { current: map } = useMap();
  useEffect(() => {
    if (!map || features.length === 0) return;
    const bounds = boundsFromFeatures(features);
    if (!bounds) return;
    map.fitBounds(bounds, { padding: 48, duration: 600, maxZoom: 17 });
  }, [map, modeKey, features]);
  return null;
}

const fillPaint = {
  'fill-color': '#3b82f6',
  'fill-opacity': 0.15,
};

const linePaint = {
  'line-color': '#2563eb',
  'line-width': 2,
};

const draftLinePaint = {
  'line-color': '#7c3aed',
  'line-width': 2,
  'line-dasharray': [2, 2],
};

/**
 * @param {object} props
 * @param {'view'|'create'|'edit'} props.mode
 * @param {object[]} props.displayFeatures  GeoJSON features to render
 * @param {[number,number][]} props.draftPoints  [lng,lat] for create mode
 * @param {[number,number][]} props.editVertices editable ring (Polygon edit)
 * @param {(lngLat: {lng:number,lat:number}) => void} [props.onMapClick]
 * @param {(index: number, lngLat: {lng:number,lat:number}) => void} [props.onVertexDrag]
 * @param {{ feature: object, nonce: number }|null} [props.flyToTarget]
 * @param {string|number} [props.modeKey]  changes trigger fitBounds
 */
export default function BoundaryMapEditor({
  mode,
  displayFeatures = [],
  draftPoints = [],
  editVertices = [],
  onMapClick,
  onVertexDrag,
  flyToTarget = null,
  modeKey = 'view',
}) {
  const tilesQuery = useQuery({
    queryKey: ['tiles'],
    queryFn: fetchTiles,
    staleTime: 60_000,
  });

  const tile = tilesQuery.data?.[0] ?? null;
  const mapStyle = useMemo(() => buildMapStyle(tile), [tile]);

  const boundaryGeoJSON = useMemo(
    () => featureCollection(displayFeatures),
    [displayFeatures]
  );

  const draftFeature = useMemo(() => buildDraftFeature(draftPoints), [draftPoints]);
  const draftGeoJSON = useMemo(
    () => (draftFeature ? featureCollection([draftFeature]) : null),
    [draftFeature]
  );

  const isDraftPolygon = draftFeature?.geometry?.type === 'Polygon';
  const cursor = mode === 'create' ? 'crosshair' : 'grab';

  if (!mapStyle) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100">
        <p className="text-slate-500 text-sm">Memuat peta…</p>
      </div>
    );
  }

  return (
    <Map
      initialViewState={{
        longitude: FALLBACK_CENTER[0],
        latitude: FALLBACK_CENTER[1],
        zoom: FALLBACK_ZOOM,
      }}
      mapStyle={mapStyle}
      attributionControl={{ compact: true }}
      style={{ width: '100%', height: '100%', cursor }}
      onClick={
        mode === 'create' && onMapClick
          ? (e) => onMapClick({ lng: e.lngLat.lng, lat: e.lngLat.lat })
          : undefined
      }
    >
      {boundaryGeoJSON.features.length > 0 ? (
        <Source id="boundaries" type="geojson" data={boundaryGeoJSON}>
          <Layer id="boundaries-fill" type="fill" paint={fillPaint} />
          <Layer id="boundaries-line" type="line" paint={linePaint} />
        </Source>
      ) : null}

      {draftGeoJSON ? (
        <Source id="draft" type="geojson" data={draftGeoJSON}>
          {isDraftPolygon ? (
            <Layer id="draft-fill" type="fill" paint={{ ...fillPaint, 'fill-color': '#7c3aed' }} />
          ) : null}
          <Layer id="draft-line" type="line" paint={draftLinePaint} />
        </Source>
      ) : null}

      {mode === 'create'
        ? draftPoints.map(([lng, lat], i) => (
            <Marker key={`draft-${i}`} longitude={lng} latitude={lat} anchor="center">
              <div className="h-3 w-3 rounded-full border-2 border-white bg-violet-600 shadow" />
            </Marker>
          ))
        : null}

      {mode === 'edit'
        ? editVertices.map(([lng, lat], i) => (
            <Marker
              key={`v-${i}`}
              longitude={lng}
              latitude={lat}
              anchor="center"
              draggable
              onDragEnd={(e) =>
                onVertexDrag?.(i, { lng: e.lngLat.lng, lat: e.lngLat.lat })
              }
            >
              <div className="h-4 w-4 rounded-full border-2 border-white bg-amber-500 shadow cursor-grab" />
            </Marker>
          ))
        : null}

      <FlyToController target={flyToTarget} />
      <FitOnModeChange features={displayFeatures} modeKey={modeKey} />
    </Map>
  );
}
