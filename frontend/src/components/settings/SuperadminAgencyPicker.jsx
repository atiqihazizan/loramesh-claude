// E3-b — superadmin target agency selector for settings API ?agency_id=

import { Building2, ChevronDown, Check } from 'lucide-react';
import Spinner from '../ui/Spinner.jsx';

export default function SuperadminAgencyPicker({
  agencyId,
  onChange,
  agencies,
  isLoading,
}) {
  const fallbackId = agencies.length > 0 ? agencies[0].id : null;
  const effectiveId = agencyId ?? fallbackId;
  const selected = agencies.find((a) => a.id === effectiveId);

  if (isLoading && agencies.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner size={18} />
        Loading agencies…
      </div>
    );
  }

  if (agencies.length === 0) {
    return (
      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
        No agencies available. Create an agency first or pass{' '}
        <code className="text-xs">agency_id</code> when calling the API.
      </p>
    );
  }

  return (
    <div className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <Building2 size={18} className="text-slate-500" />
        Settings agency
      </div>
      <div className="relative flex-1 max-w-md">
        <select
          className="input appearance-none pr-10"
          value={effectiveId ?? ''}
          onChange={(e) => onChange(Number(e.target.value))}
        >
          {agencies.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.code})
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        {/* {selected ? (
          <p className="mt-1 text-xs text-slate-400 flex items-center gap-1">
            <Check size={12} /> ID {selected.id}
          </p>
        ) : null} */}
      </div>
    </div>
  );
}
