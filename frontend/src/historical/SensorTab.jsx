// E4-d — Sensor tab: table of sensor readings over time.
// Data comes from track.points[] (already fetched by usePlayback in E4-c).

import { useMemo } from 'react';
import { errMsg } from '../lib/api.js';
import Spinner from '../components/ui/Spinner.jsx';

// Format a send_dt value into a readable local timestamp.
function fmtTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
}

// Turn one point's sensor_data into a plain string for display.
// sensor_data may be: array, object, primitive, or null.
function sensorText(sensor) {
  if (sensor === null || sensor === undefined) return '—';
  if (Array.isArray(sensor)) {
    const cleaned = sensor.filter((v) => v !== null && v !== '');
    return cleaned.length ? cleaned.join(', ') : '—';
  }
  if (typeof sensor === 'object') {
    const parts = Object.entries(sensor).map(([k, v]) => `${k}: ${v}`);
    return parts.length ? parts.join(', ') : '—';
  }
  return String(sensor);
}

function num(v, digits) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return v.toFixed(digits);
}

/**
 * @param {object} props
 * @param {object} props.track    /playback/:id response (has points[])
 * @param {boolean} props.isLoading
 * @param {boolean} props.isError
 * @param {*} props.error
 */
export default function SensorTab({ track, isLoading, isError, error }) {
  const points = useMemo(() => track?.points ?? [], [track]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spinner size={24} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <p className="text-sm text-red-600">
          {errMsg(error, 'Failed to load sensor data')}
        </p>
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <p className="text-sm text-slate-500">
          No sensor data for this device in the selected range.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 gap-3">
      {track?.downsampled ? (
        <p className="text-xs text-slate-400">
          Showing {track.count} of {track.raw_count} rows (downsampled for
          performance).
        </p>
      ) : (
        <p className="text-xs text-slate-400">{points.length} rows</p>
      )}

      <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-500">
                Time
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-500">
                Latitude
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-500">
                Longitude
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-500">
                Sensor data
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {points.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                  {fmtTime(p.send_dt)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-slate-600 font-mono">
                  {num(p.latitude, 5)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-slate-600 font-mono">
                  {num(p.longitude, 5)}
                </td>
                <td className="px-3 py-2 text-slate-600 font-mono">
                  {sensorText(p.sensor_data)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
