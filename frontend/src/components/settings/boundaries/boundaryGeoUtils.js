/** Extract outer ring vertices (without closing duplicate) from Polygon feature. */
export function polygonVerticesFromFeature(feature) {
  const geom = feature?.geometry;
  if (geom?.type !== 'Polygon') return null;
  const ring = geom.coordinates?.[0];
  if (!Array.isArray(ring) || ring.length < 3) return null;
  const verts = ring.slice();
  if (verts.length > 1) {
    const first = verts[0];
    const last = verts[verts.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) verts.pop();
  }
  return verts.map(([lng, lat]) => [lng, lat]);
}

/** Rebuild closed Polygon coordinates from vertex list. */
export function verticesToPolygon(vertices) {
  if (!vertices || vertices.length < 3) return null;
  const ring = vertices.map(([lng, lat]) => [lng, lat]);
  const a = ring[0];
  const b = ring[ring.length - 1];
  if (a[0] !== b[0] || a[1] !== b[1]) ring.push([a[0], a[1]]);
  return { type: 'Polygon', coordinates: [ring] };
}
