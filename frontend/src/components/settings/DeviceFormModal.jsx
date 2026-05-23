// E3-e — create / edit device modal

import { useState } from 'react';
import { X } from 'lucide-react';
import { errMsg } from '../../lib/api.js';
import { useDeviceTypes } from '../../hooks/useDeviceTypes.js';
import Spinner from '../ui/Spinner.jsx';

function emptyCreateForm() {
  return {
    device_id: '',
    name: '',
    device_mac: '',
    type_id: '',
    latitude: '',
    longitude: '',
    is_static: false,
    logging_enabled: true,
  };
}

function deviceToForm(device) {
  return {
    device_id: device.device_id ?? '',
    name: device.name ?? '',
    device_mac: device.device_mac ?? '',
    type_id: device.type?.id ? String(device.type.id) : '',
    latitude: device.latitude != null ? String(device.latitude) : '',
    longitude: device.longitude != null ? String(device.longitude) : '',
    is_static: Boolean(device.is_static),
    logging_enabled: device.logging_enabled !== false,
  };
}

export default function DeviceFormModal({
  mode,
  device,
  onClose,
  onSubmitCreate,
  onSubmitUpdate,
  isSubmitting,
  submitError,
}) {
  const { deviceTypes, isLoading: typesLoading } = useDeviceTypes();
  const [form, setForm] = useState(() =>
    mode === 'edit' && device ? deviceToForm(device) : emptyCreateForm()
  );
  const [localError, setLocalError] = useState(null);

  const setField = (key, value) => {
    setLocalError(null);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);

    if (!form.device_id.trim() || form.device_id.length > 100) {
      setLocalError('Device ID is required (max 100 characters)');
      return;
    }
    if (!form.name.trim() || form.name.length > 255) {
      setLocalError('Name is required (max 255 characters)');
      return;
    }

    const payload = {
      device_id: form.device_id.trim(),
      name: form.name.trim(),
      device_mac: form.device_mac.trim() || undefined,
      is_static: form.is_static,
      logging_enabled: form.logging_enabled,
    };
    if (form.type_id) payload.type_id = parseInt(form.type_id, 10);
    if (form.latitude !== '') payload.latitude = parseFloat(form.latitude);
    if (form.longitude !== '') payload.longitude = parseFloat(form.longitude);

    try {
      if (mode === 'create') {
        await onSubmitCreate(payload);
      } else {
        const patch = { ...payload };
        delete patch.device_id;
        await onSubmitUpdate(device.id, patch);
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
      <div className="rounded-xl border border-slate-200 bg-white w-full max-w-lg p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-800">
            {mode === 'create' ? 'Add device' : 'Edit device'}
          </h3>
          <button type="button" className="btn-ghost p-2" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {displayError ? (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{displayError}</p>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="dev-id">
                Device ID
              </label>
              <input
                id="dev-id"
                className="input"
                value={form.device_id}
                onChange={(e) => setField('device_id', e.target.value)}
                disabled={mode === 'edit'}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="dev-name">
                Name
              </label>
              <input
                id="dev-name"
                className="input"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="dev-mac">
                MAC (optional)
              </label>
              <input
                id="dev-mac"
                className="input"
                value={form.device_mac}
                onChange={(e) => setField('device_mac', e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="dev-type">
                Type
              </label>
              <select
                id="dev-type"
                className="input"
                value={form.type_id}
                onChange={(e) => setField('type_id', e.target.value)}
                disabled={typesLoading}
              >
                <option value="">— None —</option>
                {deviceTypes.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="dev-lat">
                Latitude
              </label>
              <input
                id="dev-lat"
                className="input"
                type="number"
                step="any"
                value={form.latitude}
                onChange={(e) => setField('latitude', e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="dev-lng">
                Longitude
              </label>
              <input
                id="dev-lng"
                className="input"
                type="number"
                step="any"
                value={form.longitude}
                onChange={(e) => setField('longitude', e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.is_static}
                onChange={(e) => setField('is_static', e.target.checked)}
              />
              Static position
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.logging_enabled}
                onChange={(e) => setField('logging_enabled', e.target.checked)}
              />
              Logging enabled
            </label>
          </div>

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
