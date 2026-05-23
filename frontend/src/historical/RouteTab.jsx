// E4-c — Route tab: historical track map + summary panel.

import { errMsg } from '../lib/api.js';
import HistoricalMap from './HistoricalMap.jsx';
import RouteSummary from './RouteSummary.jsx';
import Spinner from '../components/ui/Spinner.jsx';

/**
 * @param {object} props
 * @param {object} props.query    HistoricalContext query
 * @param {object} props.track    /playback/:id response
 * @param {object} props.summary  /playback/:id/summary response
 * @param {boolean} props.isLoading
 * @param {boolean} props.isError
 * @param {*} props.error
 */
export default function RouteTab({
  query,
  track,
  summary,
  isLoading,
  isError,
  error,
}) {
  if (query.isStatic) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <p className="text-sm text-slate-500 text-center">
          This is a static device — it has no route.
          <br />
          See the Sensor tab for its readings.
        </p>
      </div>
    );
  }

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
          {errMsg(error, 'Failed to load route data')}
        </p>
      </div>
    );
  }

  const points = track?.points ?? [];

  if (points.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <p className="text-sm text-slate-500">
          No tracking data for this device in the selected range.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 gap-4">
      <RouteSummary summary={summary} />
      {track?.downsampled ? (
        <p className="text-xs text-slate-400">
          Showing {track.count} of {track.raw_count} points (downsampled for
          performance).
        </p>
      ) : null}
      <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-slate-200">
        <HistoricalMap points={points} />
      </div>
    </div>
  );
}
