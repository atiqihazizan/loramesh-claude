// src/map/DeviceMarker.jsx
// ----------------------------------------------------------------
// Satu marker device di peta.
//
// Warna ikut status — palet yang ditetapkan dalam reka bentuk:
//   online  → hijau  #16A34A
//   idle    → kuning #CA8A04
//   offline → kelabu #94A3B8
//
// Marker = bulatan berwarna dengan cincin putih + bayang.
// Klik → panggil onClick (DeviceLayer uruskan popup).
// ----------------------------------------------------------------

import { Marker } from 'react-map-gl/maplibre';

// Padan status → warna. Status tak dikenali → offline (kelabu).
const STATUS_COLOR = {
  online: '#16A34A',
  idle: '#CA8A04',
  offline: '#94A3B8',
};

export function statusColor(status) {
  return STATUS_COLOR[(status || '').toLowerCase()] || STATUS_COLOR.offline;
}

/**
 * @param {object}   props
 * @param {object}   props.device     device (perlu latitude, longitude, status)
 * @param {boolean}  props.isSelected  marker ini sedang dipilih?
 * @param {Function} props.onClick     (device) => void
 */
export default function DeviceMarker({ device, isSelected, onClick }) {
  const color = statusColor(device.status);

  return (
    <Marker
      longitude={device.longitude}
      latitude={device.latitude}
      anchor="center"
      onClick={(e) => {
        // Halang klik daripada sampai ke peta (elak tutup popup).
        e.originalEvent.stopPropagation();
        onClick(device);
      }}
    >
      <div
        className="cursor-pointer transition-transform"
        style={{ transform: isSelected ? 'scale(1.3)' : 'scale(1)' }}
      >
        {/* Bulatan berwarna + cincin putih */}
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: '9999px',
            backgroundColor: color,
            border: '3px solid #ffffff',
            boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
          }}
        />
      </div>
    </Marker>
  );
}