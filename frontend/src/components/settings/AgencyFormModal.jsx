// E5-b1 — create/edit agency modal. On create, an optional admin user
// can be created together with the agency.

import { useState } from 'react';
import { X } from 'lucide-react';
import { errMsg } from '../../lib/api.js';

/**
 * @param {object} props
 * @param {object|null} props.agency   existing agency (edit) or null (create)
 * @param {Function} props.onSubmit    async (payload) => void
 * @param {Function} props.onClose
 * @param {boolean} props.isSaving
 * @param {*} props.error
 */
export default function AgencyFormModal({
  agency,
  onSubmit,
  onClose,
  isSaving,
  error,
}) {
  const isEdit = !!agency;
  const [name, setName] = useState(agency?.name ?? '');
  const [code, setCode] = useState(agency?.code ?? '');
  const [withAdmin, setWithAdmin] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const handleSave = async () => {
    if (!name.trim()) return;
    let payload;
    if (isEdit) {
      // PATCH only allows settings-style fields; here we update name.
      payload = { name: name.trim() };
    } else {
      if (!code.trim()) return;
      payload = { name: name.trim(), code: code.trim().toUpperCase() };
      if (withAdmin && adminUsername.trim() && adminPassword) {
        payload.admin_user = {
          username: adminUsername.trim(),
          password: adminPassword,
        };
      }
    }
    try {
      await onSubmit(payload);
      onClose();
    } catch {
      /* error shown below */
    }
  };

  const fieldCls =
    'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm ' +
    'focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-800">
            {isEdit ? 'Edit agency' : 'New agency'}
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={fieldCls}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              disabled={isEdit}
              placeholder="e.g. RISDA001"
              className={`${fieldCls} disabled:bg-slate-50 disabled:text-slate-400`}
            />
            {isEdit ? (
              <p className="text-xs text-slate-400 mt-1">
                Code cannot be changed after creation.
              </p>
            ) : (
              <p className="text-xs text-slate-400 mt-1">
                Uppercase letters, numbers, _ or - only.
              </p>
            )}
          </div>

          {!isEdit ? (
            <div className="rounded-lg border border-slate-200 p-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={withAdmin}
                  onChange={(e) => setWithAdmin(e.target.checked)}
                />
                Also create an admin user for this agency
              </label>
              {withAdmin ? (
                <div className="mt-3 space-y-2">
                  <input
                    type="text"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder="Admin username"
                    className={fieldCls}
                  />
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Admin password"
                    className={fieldCls}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

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
            disabled={isSaving || !name.trim() || (!isEdit && !code.trim())}
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
