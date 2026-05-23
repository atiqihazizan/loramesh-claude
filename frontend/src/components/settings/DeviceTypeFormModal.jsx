// E5-a — create / edit a device type.

import { useState } from 'react';
import { X } from 'lucide-react';
import { errMsg } from '../../lib/api.js';
import Spinner from '../ui/Spinner.jsx';

function toForm(type) {
  return {
    name: type?.name ?? '',
    code: type?.code ?? '',
    icon: type?.icon ?? '',
    color_code: type?.color_code ?? '#808080',
  };
}

/**
 * @param {object} props
 * @param {object|null} props.type   existing type (null = create)
 * @param {Function} props.onSubmit  (payload | {id,patch}) => Promise
 * @param {Function} props.onClose
 * @param {boolean} props.isSaving
 */
export default function DeviceTypeFormModal({ type, onSubmit, onClose, isSaving }) {
  const isEdit = !!type;
  const [form, setForm] = useState(() => toForm(type));
  const [error, setError] = useState(null);

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setError(null);
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    try {
      if (isEdit) {
        await onSubmit({ id: type.id, patch: form });
      } else {
        await onSubmit(form);
      }
      onClose();
    } catch (err) {
      setError(errMsg(err, 'Failed to save device type'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-800">
            {isEdit ? 'Edit device type' : 'New device type'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
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
              Code (e.g. MG, GW)
            </label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setField('code', e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Icon (lucide-react name, e.g. Smartphone)
            </label>
            <input
              type="text"
              value={form.icon}
              onChange={(e) => setField('icon', e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Colour</label>
            <input
              type="color"
              value={form.color_code}
              onChange={(e) => setField('color_code', e.target.value)}
              className="h-9 w-16 rounded border border-slate-200"
            />
          </div>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2
                       text-sm font-medium text-white hover:bg-brand-700
                       disabled:opacity-60"
          >
            {isSaving ? <Spinner size={16} className="text-white" /> : null}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
