// src/map/DevicePopup.jsx
// ----------------------------------------------------------------
// Popup MINIMIZE device — label kecil melabuh atas marker.
//
// Papar: nama node + lat/lon + status.
// Klik popup → buka panel detail kanan-atas (DeviceDetailPanel).
//
// Flag KEEP_POPUP_OPEN:
//   true  → popup minimize KEKAL terbuka untuk setiap marker.
//   false → tiada popup; detail dibuka terus bila marker diklik.
//
// "Maximize" (jadual detail) TIDAK lagi di sini — ia berpindah ke
// DeviceDetailPanel (panel tetap kanan-atas dengan animasi).
// ----------------------------------------------------------------

import { Popup } from 'react-map-gl/maplibre';
import { statusColor } from './DeviceMarker.jsx';
import { deviceStatusLabel } from '../lib/deviceStatus.js';

// ── FLAG ──────────────────────────────────────────────────────
// true  = popup minimize kekal terbuka untuk setiap marker
// false = tiada popup; klik marker terus buka panel detail
export const KEEP_POPUP_OPEN = true;
// ──────────────────────────────────────────────────────────────

function num(v, digits) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return v.toFixed(digits);
}

/**
 * @param {object}   props
 * @param {object}   props.device   device
 * @param {Function} props.onClick  () => void — buka panel detail
 */
export default function DevicePopup({ device, onClick }) {
  if (!device) return null;

  const color = statusColor(device.status);
  const name = device.name || device.device_id;

  return (
    <Popup
      longitude={device.longitude}
      latitude={device.latitude}
      anchor="bottom"
      offset={34}
      closeButton={false}
      closeOnClick={false}
      maxWidth="200px"
    >
      <div
        className="cursor-pointer text-center font-sans"
        onClick={onClick}
      >
        <h4 className="m-0 text-sm font-bold text-slate-800">{name}</h4>
        <p
          className="mx-auto my-0.5 inline-block rounded-full bg-slate-600
                     px-2 py-0 text-xs text-white"
        >
          {num(device.latitude, 5)}, {num(device.longitude, 5)}
        </p>
        <p className="mt-0.5 text-xs font-bold" style={{ color }}>
          {deviceStatusLabel(device.status)}
        </p>
      </div>
    </Popup>
  );
}