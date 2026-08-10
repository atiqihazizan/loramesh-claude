// Tiles — create/edit tile provider modal

import { useState } from 'react';
import { X } from 'lucide-react';
import { errMsg } from '../../lib/api.js';

function toForm(tile) {
  return {
    name: tile?.name ?? '',
    icon: tile?.icon ?? '',
    url: tile?.url ?? '',
    theme: tile?.theme ?? 'light',
  };
}

/**
 * @param {object} props
 * @param {object|null} props.tile      existing tile (edit) or null (create)
 * @param {Function} props.onSubmit     async (payload) => void
 * @param {Function} props.onClose
 * @param {boolean} props.isSaving
 * @param {*} props.error
 */
export default function TileFormModal({ tile, onSubmit, onClose, isSaving, error }) {
  const [form, setForm] = useState(() => toForm(tile));
  const isEdit = !!tile;

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.url.trim()) return;
    const payload = {
      name: form.name.trim(),
      icon: form.icon.trim() || null,
      url: form.url.trim(),
      theme: form.theme,
    };
    try {
      await onSubmit(payload);
      onClose();
    } catch {
      /* error shown below */
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-800">
            {isEdit ? 'Edit tile' : 'New tile'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Icon (optional)
            </label>
            <input
              type="text"
              value={form.icon}
              onChange={(e) => setField('icon', e.target.value)}
              placeholder="e.g. map, satellite, mountain"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">URL</label>
            <input
              type="text"
              value={form.url}
              onChange={(e) => setField('url', e.target.value)}
              placeholder="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Theme</label>
            <select
              value={form.theme}
              onChange={(e) => setField('theme', e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
          {error ? (
            <p className="text-xs text-red-600">{errMsg(error, 'Save failed')}</p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm
                       text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !form.name.trim() || !form.url.trim()}
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium
                       text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}