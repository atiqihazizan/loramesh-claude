// src/components/layout/MapLayout.jsx
// Layout PETA — peta penuh skrin, navigasi terapung di atas.
// Untuk halaman peta-sentrik: Peta (dan Historical nanti — E4).
//
// E2-shell-fix: MapLayout kini PEMILIK data peta. Ia bungkus
// segalanya dengan <MapProvider> — yang panggil useMapData sekali
// dan simpan activeTile. MapPage, MapView, MapTopOverlay semua
// berkongsi data ini melalui useMapContext().
//
// Struktur:
//   <MapProvider>
//     <div penuh skrin, relative>
//       <Outlet />            ← halaman peta (lapisan bawah)
//       <MapNavRail />        ← rel navigasi ikon terapung (kiri)
//       <MapTopOverlay />     ← logo + kad basemap/profil (atas)
//     </div>
//   </MapProvider>

import { Outlet } from 'react-router-dom';
import { MapProvider } from '../../map/MapContext.jsx';
import MapNavRail from '../../map/MapNavRail.jsx';
import MapTopOverlay from '../../map/MapTopOverlay.jsx';

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
      </div>
    </MapProvider>
  );
}