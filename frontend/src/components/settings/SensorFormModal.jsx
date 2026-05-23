// E5-a — create/edit master sensor modal

import { useState } from 'react';
import { X } from 'lucide-react';
import { errMsg } from '../../lib/api.js';

function toForm(sensor) {
  return {
    name: sensor?.name ?? '',
    short_name: sensor?.short_name ?? '',
    description: sensor?.description ?? '',
    unit: sensor?.unit ?? '',
    min_value: sensor?.min_value ?? '',
    max_value: sensor?.max_value ?? '',
  };
}

/**
 * @param {object} props
 * @param {object|null} props.sensor   existing sensor (edit) or null (create)
 * @param {Function} props.onSubmit    async (payload) => void
 * @param {Function} props.onClose
 * @param {boolean} props.isSaving
 * @param {*} props.error
 */
export default function SensorFormModal({
  sensor,
  onSubmit,
  onClose,
  isSaving,
  error,
}) {
  const [form, setForm] = useState(() => toForm(sensor));
  const isEdit = !!sensor;

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      short_name: form.short_name.trim() || null,
      description: form.description.trim() || null,
      unit: form.unit.trim() || null,
      min_value: form.min_value === '' ? null : Number(form.min_value),
      max_value: form.max_value === '' ? null : Number(form.max_value),
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
            {isEdit ? 'Edit sensor' : 'New sensor'}
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
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Name
            </label>
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
              Short name
            </label>
            <input
              type="text"
              value={form.short_name}
              onChange={(e) => setField('short_name', e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Unit
            </label>
            <input
              type="text"
              value={form.unit}
              onChange={(e) => setField('unit', e.target.value)}
              placeholder="e.g. °C"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Min value
              </label>
              <input
                type="number"
                value={form.min_value}
                onChange={(e) => setField('min_value', e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Max value
              </label>
              <input
                type="number"
                value={form.max_value}
                onChange={(e) => setField('max_value', e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
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
            disabled={isSaving || !form.name.trim()}
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
