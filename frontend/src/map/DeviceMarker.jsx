// src/map/DeviceMarker.jsx
// ----------------------------------------------------------------
// Satu marker device — pin titisan + ikon Lucide + titik status.
//
// Ikut corak kod lama (wrapper-icon):
//   - Pin bentuk titisan: border-radius 50% 50% 50% 0, putar -45°.
//   - Badan pin berwarna device_type.color_code (lalai #808080).
//   - Ikon Lucide di dalam, dipilih dari device_type.icon
//     (putar +45° balik supaya tegak).
//   - Titik status kecil di sudut: hijau online / kuning idle /
//     kelabu offline.
// ----------------------------------------------------------------

import { Marker } from 'react-map-gl/maplibre';
import { resolveDeviceTypeIcon } from '../lib/deviceTypeIcons.js';

// Warna status — untuk titik kecil di sudut pin.
const STATUS_COLOR = {
  online: '#16A34A',
  idle: '#CA8A04',
  offline: '#94A3B8',
};

export function statusColor(status) {
  return STATUS_COLOR[(status || '').toLowerCase()] || STATUS_COLOR.offline;
}

// Warna pin — dari type.color_code, lalai kelabu.
// Nota: medan dari /api/devices bernama `type` (bukan device_type).
function typeColor(device) {
  return device.type?.color_code || '#808080';
}

// Tukar nama ikon (cth "map-pin" / "Car") → komponen Lucide.
function resolveIcon(iconName) {
  return resolveDeviceTypeIcon(iconName);
}

/**
 * @param {object}   props
 * @param {object}   props.device     device (latitude, longitude, status, device_type)
 * @param {boolean}  props.isSelected  marker ini sedang dipilih?
 * @param {Function} props.onClick     (device) => void
 */
export default function DeviceMarker({ device, isSelected, onClick }) {
  const pinColor = typeColor(device);
  const dotColor = statusColor(device.status);
  const Icon = resolveIcon(device.type?.icon);

  return (
    <Marker
      longitude={device.longitude}
      latitude={device.latitude}
      anchor="bottom"
      style={{ zIndex: isSelected ? 1000 : 1 }}
      onClick={(e) => {
        e.originalEvent.stopPropagation();
        onClick(device);
      }}
    >
      <div
        className="relative cursor-pointer transition-transform"
        style={{ transform: isSelected ? 'scale(1.15)' : 'scale(1)' }}
      >
        {/* Pin titisan */}
        <div
          style={{
            width: 30,
            height: 30,
            backgroundColor: pinColor,
            border: '2px solid #ffffff',
            borderRadius: '50% 50% 50% 0',
            transform: 'rotate(-45deg)',
            boxShadow: '0 3px 8px rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Ikon — putar balik supaya tegak */}
          <span style={{ transform: 'rotate(45deg)', display: 'flex' }}>
            <Icon size={15} color="#ffffff" strokeWidth={2.5} />
          </span>
        </div>

        {/* Titik status — sudut kanan atas pin */}
        <span
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            width: 10,
            height: 10,
            borderRadius: '9999px',
            backgroundColor: dotColor,
            border: '2px solid #ffffff',
          }}
        />
      </div>
    </Marker>
  );
}