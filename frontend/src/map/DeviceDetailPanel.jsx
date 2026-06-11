// src/map/DeviceDetailPanel.jsx
// ----------------------------------------------------------------
// Panel detail device — kanan-atas, di bawah kad agency/basemap/
// profil (dengan gap).
//
// Baca selectedDeviceId dari MapContext, cari device terkini dari
// useDevices (jadi sentiasa segar bila socket kemas kini nanti).
//
// Animasi dua peringkat:
//   1. Header muncul (fade + slide masuk).
//   2. Badan "melabuh turun" membuka (max-height 0 → penuh).
//
// Satu device pada satu masa. Butang tutup → setSelectedDeviceId(null).
// ----------------------------------------------------------------

import { useState, useEffect } from 'react';
import { X, Minimize2, Maximize2 } from 'lucide-react';
import { useMapContext } from './MapContext.jsx';
import { useDevices } from '../hooks/useDevices.js';
import { statusColor } from './DeviceMarker.jsx';
import { deviceStatusLabel } from '../lib/deviceStatus.js';

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

function num(v, digits, suffix = '') {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return `${v.toFixed(digits)}${suffix}`;
}

function sensorText(sensor) {
  if (!sensor) return '—';
  if (Array.isArray(sensor)) return sensor.length ? sensor.join(', ') : '—';
  if (typeof sensor === 'object') {
    const p = Object.entries(sensor).map(([k, v]) => `${k}: ${v}`);
    return p.length ? p.join(', ') : '—';
  }
  return String(sensor);
}

export default function DeviceDetailPanel() {
  const {
    selectedDeviceId,
    setSelectedDeviceId,
    followMode,
    detailPanelMinimized,
    setDetailPanelMinimized,
  } = useMapContext();
  const { devices } = useDevices();

  // Peringkat animasi: 0 = tersembunyi, 1 = header, 2 = badan terbuka.
  const [stage, setStage] = useState(0);
  const minimized = detailPanelMinimized;
  const setMinimized = setDetailPanelMinimized;

  // Cari device terkini dari senarai (sentiasa segar).
  const device =
    selectedDeviceId != null
      ? devices.find((d) => d.device_id === selectedDeviceId) || null
      : null;

  // Animasi hanya bila pilihan device berubah (klik marker / tutup),
  // bukan bila data socket kemas kini objek device yang sama.
  useEffect(() => {
    if (selectedDeviceId == null) {
      setStage(0);
      setMinimized(false);
      return;
    }
    setMinimized(followMode);
    setStage(1);
    const t = setTimeout(() => setStage(2), 180);
    return () => clearTimeout(t);
  }, [selectedDeviceId, setMinimized]);

  if (!device) return null;

  const color = statusColor(device.status);
  const name = device.name || device.device_id;
  // Medan dari /api/devices bernama `type` (bukan device_type).
  const typeName = device.type?.name || '—';

  return (
    <div
      className="absolute right-3 top-20 z-20 w-64 overflow-hidden
                 rounded-xl bg-white/95 shadow-lg ring-1 ring-slate-200
                 backdrop-blur transition-all duration-200"
      style={{
        opacity: stage >= 1 ? 1 : 0,
        transform: stage >= 1 ? 'translateY(0)' : 'translateY(-8px)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between gap-2 px-3 py-2.5"
        style={{
          borderBottom: stage >= 2 ? '1px solid #e2e8f0' : 'none',
        }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: '9999px',
              backgroundColor: color,
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          <span className="truncate text-sm font-semibold text-slate-800">
            {name}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => setMinimized((v) => !v)}
            title={minimized ? 'Expand' : 'Minimize'}
            className="rounded p-0.5 text-slate-400 transition-colors
                       hover:bg-slate-100"
          >
            {minimized ? <Maximize2 size={15} /> : <Minimize2 size={15} />}
          </button>
          <button
            type="button"
            onClick={() => setSelectedDeviceId(null)}
            title="Close"
            className="rounded p-0.5 text-slate-400 transition-colors
                       hover:bg-slate-100"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Badan — melabuh turun membuka */}
      <div
        className="transition-all duration-300 ease-out"
        style={{
          maxHeight: stage >= 2 ? (minimized ? 120 : 400) : 0,
          opacity: stage >= 2 ? 1 : 0,
        }}
      >
        <table className="w-full text-xs">
          <tbody>
            {!minimized && (
              <>
                <Row label="Status">
                  <span className="font-semibold" style={{ color }}>
                    {deviceStatusLabel(device.status)}
                  </span>
                </Row>
                <Row label="Type">{typeName}</Row>
              </>
            )}
            <Row label="Time" mono>
              {formatTime(device.send_dt || device.last_seen_at)}
            </Row>
            <Row label="Latitude" mono>{num(device.latitude, 5)}</Row>
            <Row label="Longitude" mono last={minimized}>
              {num(device.longitude, 5)}
            </Row>
            {!minimized && (
              <>
                <Row label="Speed" mono>
                  {num(device.speed, 0, ' km/h')}
                </Row>
                <Row label="CPU temp" mono>
                  {num(device.cpu_temp, 1, ' °C')}
                </Row>
                <Row label="Sensor" mono last>
                  {sensorText(device.sensor_data)}
                </Row>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ label, children, mono, last }) {
  return (
    <tr className={last ? '' : 'border-b border-slate-100'}>
      <td className="whitespace-nowrap px-3 py-1.5 align-top font-semibold text-slate-500">
        {label}
      </td>
      <td
        className={
          'px-3 py-1.5 text-right text-slate-800 ' + (mono ? 'font-mono' : '')
        }
      >
        {children}
      </td>
    </tr>
  );
}