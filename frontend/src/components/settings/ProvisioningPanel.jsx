// E5-b2 — provisioning panel: create + list enrollment nonces.
// Reusable: used in Agency Settings (admin) and Agencies page (superadmin).
// NOTE: shows nonce code as text + copy; no QR image library is installed.

import { useState } from 'react';
import { Plus, Trash2, Copy, Check } from 'lucide-react';
import { errMsg } from '../../lib/api.js';
import { useProvisioning } from '../../hooks/useProvisioning.js';
import ConfirmDialog from './ConfirmDialog.jsx';

function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * @param {object} props
 * @param {number|null} props.agencyId  target agency (superadmin) or null (own)
 */
export default function ProvisioningPanel({ agencyId = null }) {
  const {
    nonces,
    isLoading,
    error,
    createNonce,
    revokeNonce,
    isCreating,
    isRevoking,
    lastCreated,
  } = useProvisioning(agencyId);

  const [label, setLabel] = useState('');
  const [createError, setCreateError] = useState(null);
  const [confirmRevoke, setConfirmRevoke] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    setCreateError(null);
    try {
      await createNonce({ label: label.trim() || null });
      setLabel('');
    } catch (err) {
      setCreateError(err);
    }
  };

  const handleCopy = (text) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    }
  };

  const runRevoke = async () => {
    if (!confirmRevoke) return;
    try {
      await revokeNonce(confirmRevoke.id);
      setConfirmRevoke(null);
    } catch {
      /* keep dialog; error surfaced by hook state if needed */
    }
  };

  return (
    <div className="space-y-4">
      {/* Create row */}
      <div className="flex gap-2">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (optional) — e.g. Ladang A enrollment"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={isCreating}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2
                     text-sm font-medium text-white hover:bg-brand-700
                     disabled:opacity-50"
        >
          <Plus size={16} />
          {isCreating ? 'Generating…' : 'Generate code'}
        </button>
      </div>

      {createError ? (
        <p className="text-xs text-red-600">
          {errMsg(createError, 'Failed to generate code')}
        </p>
      ) : null}

      {/* Just-created nonce highlight */}
      {lastCreated?.nonce ? (
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-3">
          <p className="text-xs text-slate-500 mb-1">
            New enrollment code — scan or enter in the app:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-white px-2 py-1.5 text-sm font-mono
                             text-slate-800 break-all">
              {lastCreated.nonce}
            </code>
            <button
              type="button"
              onClick={() => handleCopy(lastCreated.qr_string || lastCreated.nonce)}
              className="flex items-center gap-1 rounded-lg border border-slate-200
                         px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      ) : null}

      {/* Active codes list */}
      {isLoading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600">
          {errMsg(error, 'Failed to load codes')}
        </p>
      ) : nonces.length === 0 ? (
        <p className="text-sm text-slate-400">No enrollment codes yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-500">
                  Code
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-500">
                  Label
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-500">
                  Claims
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-500">
                  Expires
                </th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {nonces.map((n) => (
                <tr key={n.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-slate-700">
                    {n.nonce}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{n.label || '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{n.claim_count}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {n.is_expired ? (
                      <span className="text-slate-400">Expired</span>
                    ) : (
                      fmtDate(n.expires_at)
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!n.is_expired ? (
                      <button
                        type="button"
                        onClick={() => setConfirmRevoke(n)}
                        className="rounded p-1.5 text-red-500 hover:bg-red-50"
                        aria-label="Revoke"
                      >
                        <Trash2 size={15} />
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmRevoke ? (
        <ConfirmDialog
          title="Revoke enrollment code"
          message={`Revoke code "${confirmRevoke.nonce}"? Devices can no longer enroll with it.`}
          confirmLabel="Revoke"
          danger
          isBusy={isRevoking}
          onConfirm={runRevoke}
          onCancel={() => setConfirmRevoke(null)}
        />
      ) : null}
    </div>
  );
}
