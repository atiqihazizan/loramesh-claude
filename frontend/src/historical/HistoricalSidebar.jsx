// E4-b — historical sidebar: query form (agency → date range → device → View)

import { useState, useMemo } from 'react';
import { History, Search } from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';
import { useAgencies } from '../hooks/useAgencies.js';
import { useHistoricalDevices } from './useHistoricalDevices.js';
import { useHistoricalContext } from './HistoricalContext.jsx';

// Convert <input type="date"> value (YYYY-MM-DD) into a full
// MySQL-friendly timestamp the backend's parseTrackingDate accepts.
function toStartOfDay(d) {
  return d ? `${d} 00:00:00` : null;
}
function toEndOfDay(d) {
  return d ? `${d} 23:59:59` : null;
}

export default function HistoricalSidebar() {
  const isSuperadmin = useAuthStore((s) => s.isSuperadmin());
  const { agencies, isLoading: agenciesLoading } = useAgencies();
  const { setQuery } = useHistoricalContext();

  const [agencyId, setAgencyId] = useState(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [formError, setFormError] = useState(null);

  const { devices, isLoading: devicesLoading } = useHistoricalDevices(agencyId);

  // Device chosen — used to carry is_static into the query.
  const selectedDevice = useMemo(
    () => devices.find((d) => d.device_id === deviceId) || null,
    [devices, deviceId]
  );

  const handleView = () => {
    setFormError(null);
    if (isSuperadmin && agencyId == null) {
      setFormError('Select an agency first.');
      return;
    }
    if (!fromDate || !toDate) {
      setFormError('Select both From and To dates.');
      return;
    }
    if (fromDate > toDate) {
      setFormError('From date must be on or before To date.');
      return;
    }
    if (!deviceId) {
      setFormError('Select a device.');
      return;
    }
    setQuery({
      deviceId,
      deviceName: selectedDevice?.name || deviceId,
      isStatic: selectedDevice?.is_static === true,
      from: toStartOfDay(fromDate),
      to: toEndOfDay(toDate),
    });
  };

  return (
    <aside
      className="w-72 shrink-0 bg-white border-r border-slate-200 flex flex-col py-4 z-20 overflow-y-auto"
      aria-label="Historical query"
    >
      <p className="px-4 mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
        <History size={12} aria-hidden />
        Historical query
      </p>

      <div className="px-4 space-y-4">
        {/* Agency — superadmin only */}
        {isSuperadmin ? (
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Agency
            </label>
            <select
              value={agencyId ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                setAgencyId(v === '' ? null : Number(v));
                setDeviceId('');
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">
                {agenciesLoading ? 'Loading…' : 'Select agency'}
              </option>
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.code})
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {/* From date */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            From
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* To date */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            To
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Device */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Device
          </label>
          <select
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            disabled={isSuperadmin && agencyId == null}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-brand-500
                       disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">
              {devicesLoading ? 'Loading…' : 'Select device'}
            </option>
            {devices.map((d) => (
              <option key={d.device_id} value={d.device_id}>
                {d.name} {d.is_static ? '(static)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Error */}
        {formError ? (
          <p className="text-xs text-red-600">{formError}</p>
        ) : null}

        {/* View button */}
        <button
          type="button"
          onClick={handleView}
          className="w-full flex items-center justify-center gap-2 rounded-lg
                     bg-brand-600 px-3 py-2 text-sm font-medium text-white
                     transition-colors hover:bg-brand-700"
        >
          <Search size={16} />
          View
        </button>
      </div>
    </aside>
  );
}
