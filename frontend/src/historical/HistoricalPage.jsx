// E4-b — historical page: shows the submitted query (tabs added in E4-c/E4-d)

import { useHistoricalContext } from './HistoricalContext.jsx';

export default function HistoricalPage() {
  const { query } = useHistoricalContext();

  if (!query) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-slate-500 text-sm">
          Select an agency, date range, and device, then click View.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <p className="text-sm text-slate-700">
        Query ready for <span className="font-medium">{query.deviceName}</span>{' '}
        ({query.isStatic ? 'static' : 'moving'}) — {query.from} to {query.to}.
      </p>
      <p className="text-xs text-slate-400 mt-2">
        Route / Sensor tabs coming in E4-c and E4-d.
      </p>
    </div>
  );
}
