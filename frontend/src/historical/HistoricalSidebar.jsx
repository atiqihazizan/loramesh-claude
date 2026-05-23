// E4-b — historical sidebar: query form (agency → device → date range → View)
// E4-b2 — date range chosen via RangeCalendar, constrained by playback bounds.

import { useState, useMemo } from 'react';
import { History, Search } from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';
import { useAgencies } from '../hooks/useAgencies.js';
import { useHistoricalDevices } from './useHistoricalDevices.js';
import { usePlaybackBounds } from './usePlaybackBounds.js';
import { useHistoricalContext } from './HistoricalContext.jsx';
import RangeCalendar from './RangeCalendar.jsx';

// Format a Date → "YYYY-MM-DD" (local, no timezone shift).
function ymd(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
// Parse "YYYY-MM-DD..." (from API bounds) → Date at local midnight.
function parseYmd(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export default function HistoricalSidebar() {
  const isSuperadmin = useAuthStore((s) => s.isSuperadmin());
  const { agencies, isLoading: agenciesLoading } = useAgencies();
  const { setQuery } = useHistoricalContext();

  const [agencyId, setAgencyId] = useState(null);
  const [deviceId, setDeviceId] = useState('');
  const [range, setRange] = useState(undefined); // { from, to } from RangeCalendar
  const [formError, setFormError] = useState(null);

  const { devices, isLoading: devicesLoading } = useHistoricalDevices(agencyId);
  const { bounds, isLoading: boundsLoading } = usePlaybackBounds(deviceId);

  const selectedDevice = useMemo(
    () => devices.find((d) => d.device_id === deviceId) || null,
    [devices, deviceId]
  );

  const minDate = useMemo(() => parseYmd(bounds?.earliest), [bounds]);
  const maxDate = useMemo(() => parseYmd(bounds?.latest), [bounds]);

  const handleView = () => {
    setFormError(null);
    if (isSuperadmin && agencyId == null) {
      setFormError('Select an agency first.');
      return;
    }
    if (!deviceId) {
      setFormError('Select a device.');
      return;
    }
    if (!range?.from) {
      setFormError('Pick a date (or a date range) on the calendar.');
      return;
    }
    // Pick 1 date → single day: from === to.
    const fromDay = range.from;
    const toDay = range.to || range.from;
    setQuery({
      deviceId,
      deviceName: selectedDevice?.name || deviceId,
      isStatic: selectedDevice?.is_static === true,
      from: `${ymd(fromDay)} 00:00:00`,
      to: `${ymd(toDay)} 23:59:59`,
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
                setRange(undefined);
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

        {/* Device */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Device
          </label>
          <select
            value={deviceId}
            onChange={(e) => {
              setDeviceId(e.target.value);
              setRange(undefined);
            }}
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

        {/* Date range calendar */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Date range
          </label>
          <RangeCalendar
            range={range}
            onChange={setRange}
            minDate={minDate}
            maxDate={maxDate}
            disabled={!deviceId}
          />
          {deviceId && boundsLoading ? (
            <p className="text-xs text-slate-400 mt-1">Loading available dates…</p>
          ) : null}
          {deviceId && !boundsLoading && bounds && bounds.total_points === 0 ? (
            <p className="text-xs text-slate-400 mt-1">
              No historical data for this device.
            </p>
          ) : null}
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
