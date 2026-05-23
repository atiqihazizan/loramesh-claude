// src/components/layout/MapLayout.jsx
// Layout PETA — peta penuh skrin, navigasi terapung di atas.
// Untuk halaman peta-sentrik: Peta (dan Historical nanti — E4).
//
// MapLayout PEMILIK data peta — bungkus <MapProvider>.
//
// Susun atur terapung:
//   kiri-atas    : logo + nama (+ agency)
//   kiri-atas-2  : TypeFilter (penapis jenis peranti)
//   kanan-atas   : kad [agency | basemap | profil] — nav dalam dropdown profil
//   kanan-atas-2 : DeviceDetailPanel (panel detail device)
//   kanan-bawah  : zoom (MapControls) + FollowToggle (MapView, atas zoom)
//   kiri-bawah   : bar skala

import { Outlet } from 'react-router-dom';
import { MapProvider } from '../../map/MapContext.jsx';
import MapTopOverlay from '../../map/MapTopOverlay.jsx';
import TypeFilter from '../../map/TypeFilter.jsx';
import DeviceDetailPanel from '../../map/DeviceDetailPanel.jsx';

export default function MapLayout() {
  return (
    <MapProvider>
      <div className="relative h-full w-full overflow-hidden">
        {/* Lapisan bawah — halaman peta, isi penuh skrin */}
        <div className="absolute inset-0 z-0">
          <Outlet />
        </div>

        {/* Overlay — navigasi terapung di atas peta */}
        <MapTopOverlay />

        {/* Overlay — penapis jenis peranti (kiri) */}
        <TypeFilter />

        {/* Overlay — panel detail device (kanan-atas) */}
        <DeviceDetailPanel />
      </div>
    </MapProvider>
  );
}
