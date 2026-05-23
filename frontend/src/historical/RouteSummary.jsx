// E4-c — summary panel for a historical route (distance, speed, duration).

import { Route, Gauge, Clock, MapPin } from 'lucide-react';

function fmtDuration(minutes) {
  if (!minutes || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/**
 * @param {object} props
 * @param {object|null} props.summary  /playback/:id/summary response
 */
export default function RouteSummary({ summary }) {
  if (!summary) return null;

  const items = [
    {
      icon: Route,
      label: 'Distance',
      value: `${summary.distance_km ?? 0} km`,
    },
    {
      icon: Gauge,
      label: 'Avg / Max speed',
      value: `${summary.avg_speed ?? 0} / ${summary.max_speed ?? 0}`,
    },
    {
      icon: Clock,
      label: 'Duration',
      value: fmtDuration(summary.duration_minutes),
    },
    {
      icon: MapPin,
      label: 'Points',
      value: summary.total_points ?? 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map(({ icon: Icon, label, value }) => (
        <div
          key={label}
          className="rounded-lg border border-slate-200 bg-white p-3"
        >
          <div className="flex items-center gap-1.5 text-slate-400">
            <Icon size={14} aria-hidden />
            <span className="text-xs font-medium">{label}</span>
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
        </div>
      ))}
    </div>
  );
}
