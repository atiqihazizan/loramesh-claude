// Display names for basemap tiles (DB may still use legacy names).

const DISPLAY = {
  Satelit: 'Satellite',
};

export function basemapDisplayName(name) {
  if (!name) return '—';
  return DISPLAY[name] || name;
}

/** Resolve tile row by canonical or legacy name. */
export function findTileByBasemapName(tiles, wanted) {
  if (!Array.isArray(tiles) || tiles.length === 0) return null;
  const key = wanted.toLowerCase();
  return (
    tiles.find((t) => t.name?.toLowerCase() === key) ||
    (wanted === 'Satellite'
      ? tiles.find((t) => t.name?.toLowerCase() === 'satelit')
      : null) ||
    tiles[0]
  );
}
