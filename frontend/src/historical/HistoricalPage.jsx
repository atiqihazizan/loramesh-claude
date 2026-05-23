// Historical page: Route / Sensor tabs.
// Route tab: track map + summary. Sensor tab: reading table.
// Route tab (tracking) is hidden for static devices.

import { useState } from 'react';
import { Route, Activity } from 'lucide-react';
import { useHistoricalContext } from './HistoricalContext.jsx';
import { usePlayback } from './usePlayback.js';
import RouteTab from './RouteTab.jsx';
import SensorTab from './SensorTab.jsx';

function HistoricalPageContent({ query }) {
  const isStatic = query.isStatic === true;
  // Static devices have no route — start on Sensor.
  const [tab, setTab] = useState(isStatic ? 'sensor' : 'route');
  // Static devices still need their sensor data — always fetch.
  const playback = usePlayback(query);

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

      {/* Tabs — Route (tracking) hidden for static devices */}
      <div className="flex border-b border-slate-200 px-4 mt-2">
        {!isStatic ? (
          <button
            type="button"
            className={tabClass(tab === 'route')}
            onClick={() => setTab('route')}
          >
            <Route size={16} />
            Route
          </button>
        ) : null}
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
        {!isStatic && tab === 'route' ? (
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

export default function HistoricalPage() {
  const { query } = useHistoricalContext();

  if (!query) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-slate-500 text-sm">
          Select an agency, device, and date range, then click View.
        </p>
      </div>
    );
  }

  return (
    <HistoricalPageContent
      key={`${query.deviceId}:${query.from}:${query.to}`}
      query={query}
    />
  );
}
