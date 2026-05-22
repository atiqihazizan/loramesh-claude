// src/map/DevicePopup.jsx
// ----------------------------------------------------------------
// Popup device — dua keadaan, dikawal flag KEEP_POPUP_OPEN.
//
// Ikut corak kod lama (createPopupContent), ditulis semula dalam
// komponen React betul (bukan HTML string + onclick global).
//
//   KEEP_POPUP_OPEN = true  → popup KEKAL terbuka, mula MINIMIZE.
//       minimize : nama node + lat/lon + status
//       klik     → MAXIMIZE (jadual penuh)
//       klik     → kembali minimize (kitar)
//
//   KEEP_POPUP_OPEN = false → tiada popup sehingga marker diklik.
//       klik marker → terus MAXIMIZE (jadual penuh)
//       tiada keadaan minimize
//
// Maximize = "detail" — jadual: Status, Masa, Lat, Lon, Kelajuan,
// Suhu CPU, Sensor. Medan tiada → "—" (akan terisi bila socket
// device:update masuk — E2-markers-b).
// ----------------------------------------------------------------

import { Popup } from 'react-map-gl/maplibre';
import { ChevronDown } from 'lucide-react';
import { statusColor } from './DeviceMarker.jsx';

// ── FLAG ──────────────────────────────────────────────────────
// true  = gaya kod lama (popup kekal, ada minimize/maximize)
// false = tiada popup sehingga klik marker, terus maximize
export const KEEP_POPUP_OPEN = true;
// ──────────────────────────────────────────────────────────────

const STATUS_LABEL = {
  online: 'Online',
  idle: 'Idle',
  offline: 'Offline',
};

function statusLabel(status) {
  return STATUS_LABEL[(status || '').toLowerCase()] || 'Offline';
}

// Format masa penuh — YYYY-MM-DD HH:MM:SS.
function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
}

// Format nombor selamat.
function num(v, digits, suffix = '') {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return `${v.toFixed(digits)}${suffix}`;
}

// Sensor — boleh array / objek / string / null.
function sensorText(sensor) {
  if (!sensor) return '—';
  if (Array.isArray(sensor)) return sensor.length ? sensor.join(', ') : '—';
  if (typeof sensor === 'object') {
    const parts = Object.entries(sensor).map(([k, v]) => `${k}: ${v}`);
    return parts.length ? parts.join(', ') : '—';
  }
  return String(sensor);
}

/**
 * @param {object}   props
 * @param {object}   props.device      device
 * @param {boolean}  props.isMaximized  popup ini dalam keadaan maximize?
 * @param {Function} props.onToggle     () => void — tukar min/max (flag true)
 * @param {Function} props.onClose      () => void — tutup (flag false)
 */
export default function DevicePopup({ device, isMaximized, onToggle, onClose }) {
  if (!device) return null;

  const color = statusColor(device.status);
  const name = device.name || device.device_id;
  const lat = device.latitude;
  const lng = device.longitude;

  return (
    <Popup
      longitude={lng}
      latitude={lat}
      anchor="bottom"
      offset={18}
      closeButton={false}
      closeOnClick={false}
      maxWidth="260px"
    >
      {isMaximized ? (
        // ── MAXIMIZE — jadual penuh ──────────────────────────
        <div className="min-w-[200px] font-sans">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full
                         px-2.5 py-1 text-xs font-semibold text-white"
              style={{ backgroundColor: color }}
            >
              {name}
            </span>
            {/* Butang minimize — hanya bila flag true */}
            {KEEP_POPUP_OPEN && (
              <button
                type="button"
                onClick={onToggle}
                title="Minimize"
                className="rounded p-0.5 text-slate-500 transition-colors
                           hover:bg-slate-100"
              >
                <ChevronDown size={16} />
              </button>
            )}
            {/* Butang tutup — hanya bila flag false */}
            {!KEEP_POPUP_OPEN && (
              <button
                type="button"
                onClick={onClose}
                title="Close"
                className="rounded p-0.5 text-slate-400 transition-colors
                           hover:bg-slate-100"
              >
                ✕
              </button>
            )}
          </div>

          <table className="w-full overflow-hidden rounded bg-slate-50 text-xs">
            <tbody>
              <DetailRow label="Status">
                <span className="font-semibold" style={{ color }}>
                  {statusLabel(device.status)}
                </span>
              </DetailRow>
              <DetailRow label="Time" mono>
                {formatTime(device.send_dt || device.last_seen_at)}
              </DetailRow>
              <DetailRow label="Latitude" mono>{num(lat, 5)}</DetailRow>
              <DetailRow label="Longitude" mono>{num(lng, 5)}</DetailRow>
              <DetailRow label="Speed" mono>
                {num(device.speed, 0, ' km/h')}
              </DetailRow>
              <DetailRow label="CPU temp" mono>
                {num(device.cpu_temp, 1, ' °C')}
              </DetailRow>
              <DetailRow label="Sensor" mono last>
                {sensorText(device.sensor_data)}
              </DetailRow>
            </tbody>
          </table>
        </div>
      ) : (
        // ── MINIMIZE — nama + lat/lon + status ───────────────
        <div
          className="cursor-pointer text-center font-sans"
          onClick={onToggle}
        >
          <h4 className="m-0 text-sm font-bold text-slate-800">{name}</h4>
          <p
            className="mx-auto my-0.5 inline-block rounded-full bg-slate-600
                       px-2 py-0 text-xs text-white"
          >
            {num(lat, 5)}, {num(lng, 5)}
          </p>
          <p
            className="mt-0.5 text-xs font-bold"
            style={{ color }}
          >
            {statusLabel(device.status)}
          </p>
        </div>
      )}
    </Popup>
  );
}

function DetailRow({ label, children, mono, last }) {
  return (
    <tr className={last ? '' : 'border-b border-slate-200'}>
      <td className="whitespace-nowrap px-2 py-1 align-top font-semibold text-slate-600">
        {label}
      </td>
      <td
        className={
          'px-2 py-1 text-right text-slate-800 ' + (mono ? 'font-mono' : '')
        }
      >
        {children}
      </td>
    </tr>
  );
}