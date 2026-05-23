// E3-a — settings data table (search + styled rows)

import { Search } from 'lucide-react';
import Spinner from '../ui/Spinner.jsx';

/**
 * @param {object} props
 * @param {string} [search] controlled search value
 * @param {(v: string) => void} [onSearchChange]
 * @param {string} [searchPlaceholder]
 * @param {{ key: string, label: string, className?: string, render?: (row) => React.ReactNode }[]} columns
 * @param {object[]} rows
 * @param {(row) => React.ReactNode} [renderActions]
 * @param {boolean} [isLoading]
 * @param {string} [emptyMessage]
 */
export default function DataTable({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  columns,
  rows,
  renderActions,
  isLoading,
  emptyMessage = 'No records',
}) {
  return (
    <div className="space-y-4">
      {onSearchChange ? (
        <div className="relative max-w-md">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            className="input pl-10 w-full"
            placeholder={searchPlaceholder}
            value={search ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner size={28} className="text-brand-600" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm text-left min-w-[640px]">
            <thead>
              <tr className="bg-slate-50 text-xs font-medium uppercase text-slate-500 divide-y divide-slate-200">
                {columns.map((col) => (
                  <th key={col.key} className={`py-3 px-3 ${col.className || ''}`}>
                    {col.label}
                  </th>
                ))}
                {renderActions ? (
                  <th className="py-3 px-3 text-right">Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (renderActions ? 1 : 0)}
                    className="py-8 text-center text-slate-400"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    {columns.map((col) => (
                      <td key={col.key} className={`py-2.5 px-3 text-slate-700 ${col.className || ''}`}>
                        {col.render ? col.render(row) : row[col.key] ?? '—'}
                      </td>
                    ))}
                    {renderActions ? (
                      <td className="py-2.5 px-3">
                        <div className="flex justify-end gap-1">{renderActions(row)}</div>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
