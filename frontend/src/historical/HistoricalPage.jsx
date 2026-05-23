// E4-c — historical page: Route / Sensor tabs.
// E4-d — Sensor tab fully built.

import { useState } from 'react';
import { Route, Activity } from 'lucide-react';
import { useHistoricalContext } from './HistoricalContext.jsx';
import { usePlayback } from './usePlayback.js';
import RouteTab from './RouteTab.jsx';
import SensorTab from './SensorTab.jsx';

export default function HistoricalPage() {
  const { query } = useHistoricalContext();
  const playback = usePlayback(query);

  // Tab state. Default is derived per-query from a key on the
  // wrapper so static devices open on Sensor without a setState
  // inside an effect.
  return (
    <HistoricalPageInner
      key={`${query?.deviceId || 'none'}:${query?.from || ''}`}
      query={query}
      playback={playback}
    />
  );
}

function HistoricalPageInner({ query, playback }) {
  // Initial tab decided once, when this instance mounts (the key in
  // the parent remounts it whenever the query changes).
  const [tab, setTab] = useState(query?.isStatic ? 'sensor' : 'route');

  if (!query) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-slate-500 text-sm">
          Select an agency, device, and date range, then click View.
        </p>
      </div>
    );
  }

  const tabClass = (active) =>
    'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ' +
    (active
      ? 'border-brand-600 text-brand-700'
      : 'border-transparent text-slate-500 hover:text-slate-700');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4">
        <h1 className="text-base font-semibold text-slate-800">
          {query.deviceName}
        </h1>
        <p className="text-xs text-slate-400">
          {query.from} → {query.to}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 px-4 mt-2">
        <button
          type="button"
          className={tabClass(tab === 'route')}
          onClick={() => setTab('route')}
        >
          <Route size={16} />
          Route
        </button>
        <button
          type="button"
          className={tabClass(tab === 'sensor')}
          onClick={() => setTab('sensor')}
        >
          <Activity size={16} />
          Sensor
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0">
        {tab === 'route' ? (
          <RouteTab
            query={query}
            track={playback.track}
            summary={playback.summary}
            isLoading={playback.isLoading}
            isError={playback.isError}
            error={playback.error}
          />
        ) : (
          <SensorTab
            track={playback.track}
            isLoading={playback.isLoading}
            isError={playback.isError}
            error={playback.error}
          />
        )}
      </div>
    </div>
  );
}
