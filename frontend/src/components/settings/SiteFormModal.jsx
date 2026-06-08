// E3-f — create / edit monitoring site modal

import { useState } from 'react';
import { X } from 'lucide-react';
import { errMsg } from '../../lib/api.js';
import Spinner from '../ui/Spinner.jsx';

function emptyCreateForm() {
  return {
    name: '',
    latlng: '',
    zoom: 13,
    publish: false,
    slug: '',
  };
}

function siteToForm(site) {
  return {
    name: site.name ?? '',
    latlng: site.latlng ?? '',
    zoom: site.zoom ?? 13,
    publish: Boolean(site.publish),
    slug: site.slug ?? '',
  };
}

export default function SiteFormModal({
  mode,
  site,
  onClose,
  onSubmitCreate,
  onSubmitUpdate,
  isSubmitting,
  submitError,
}) {
  const [form, setForm] = useState(() =>
    mode === 'edit' && site ? siteToForm(site) : emptyCreateForm()
  );
  const [localError, setLocalError] = useState(null);

  const setField = (key, value) => {
    setLocalError(null);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);

    if (!form.name.trim() || form.name.length > 70) {
      setLocalError('Name is required (max 70 characters)');
      return;
    }
    const zoom = Number(form.zoom);
    if (!Number.isFinite(zoom) || zoom < 1 || zoom > 22) {
      setLocalError('Zoom must be between 1 and 22');
      return;
    }

    const payload = {
      name: form.name.trim(),
      latlng: form.latlng.trim() || undefined,
      zoom,
      publish: form.publish,
      slug: form.slug.trim() || undefined,
    };

    try {
      if (mode === 'create') {
        await onSubmitCreate(payload);
      } else {
        await onSubmitUpdate(site.id, payload);
      }
      onClose();
    } catch (err) {
      setLocalError(errMsg(err));
      throw err;
    }
  };

  const displayError = localError || (submitError ? errMsg(submitError) : null);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div className="rounded-xl border border-slate-200 bg-white w-full max-w-md p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-800">
            {mode === 'create' ? 'Add site' : 'Edit site'}
          </h3>
          <button type="button" className="btn-ghost p-2" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {displayError ? (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{displayError}</p>
          ) : null}

          <div>
            <label className="label" htmlFor="site-name">
              Name
            </label>
            <input
              id="site-name"
              className="input"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="site-latlng">
              Center (lat,lng)
            </label>
            <input
              id="site-latlng"
              className="input"
              placeholder="3.139,101.687"
              value={form.latlng}
              onChange={(e) => setField('latlng', e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="site-zoom">
              Zoom (1–22)
            </label>
            <input
              id="site-zoom"
              className="input"
              type="number"
              min={1}
              max={22}
              value={form.zoom}
              onChange={(e) => setField('zoom', e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="site-slug">
              Slug (optional)
            </label>
            <input
              id="site-slug"
              className="input"
              value={form.slug}
              onChange={(e) => setField('slug', e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.publish}
              onChange={(e) => setField('publish', e.target.checked)}
            />
            Published on map
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? <Spinner size={18} className="text-white" /> : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
