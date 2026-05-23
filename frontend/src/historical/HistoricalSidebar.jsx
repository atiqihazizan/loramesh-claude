// E4-a — historical sidebar (placeholder; query form added in E4-b)

import { History } from 'lucide-react';

export default function HistoricalSidebar() {
  return (
    <aside
      className="w-72 shrink-0 bg-white border-r border-slate-200 flex flex-col py-4 z-20"
      aria-label="Historical query"
    >
      <p className="px-4 mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
        <History size={12} aria-hidden />
        Historical
      </p>
      <p className="px-4 text-sm text-slate-400">
        Query form coming soon.
      </p>
    </aside>
  );
}
