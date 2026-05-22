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