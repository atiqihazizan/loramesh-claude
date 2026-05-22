// src/components/layout/MapLayout.jsx
// Layout PETA — peta penuh skrin, navigasi terapung di atas.
// Untuk halaman peta-sentrik: Peta (dan Historical nanti — E4).
//
// E2-shell-fix: MapLayout PEMILIK data peta — bungkus <MapProvider>.
// E2-ptz: tambah Map3DToggle + MapCompass ke overlay.
//
// Susun atur terapung:
//   kiri-atas    : logo + nama
//   kanan-atas   : kad [basemap | profil]
//   kiri-tengah  : MapNavRail
//   kanan-bawah  : zoom (MapControls) + Map3DToggle (atasnya)
//   kiri-bawah   : bar skala + MapCompass

import { Outlet } from 'react-router-dom';
import { MapProvider } from '../../map/MapContext.jsx';
import MapNavRail from '../../map/MapNavRail.jsx';
import MapTopOverlay from '../../map/MapTopOverlay.jsx';
import Map3DToggle from '../../map/Map3DToggle.jsx';
import MapCompass from '../../map/MapCompass.jsx';

export default function MapLayout() {
  return (
    <MapProvider>
      <div className="relative h-full w-full overflow-hidden">
        {/* Lapisan bawah — halaman peta, isi penuh skrin */}
        <div className="absolute inset-0">
          <Outlet />
        </div>

        {/* Overlay — navigasi terapung di atas peta */}
        <MapNavRail />
        <MapTopOverlay />

        {/* Overlay — kawalan 3D */}
        {/* <Map3DToggle />
        <MapCompass /> */}
      </div>
    </MapProvider>
  );
}