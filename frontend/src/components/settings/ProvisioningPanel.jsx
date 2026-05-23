// E5-c2 — provisioning panel: one token per agency, with expiry.
// Valid token → show QR + expiry + End button.
// No/expired token → Generate button.
// SUPERADMIN-only (used in Agencies page). agencyId is required.

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { QrCode, Power, RefreshCw } from 'lucide-react';
import { errMsg } from '../../lib/api.js';
import { useAgencyToken } from '../../hooks/useAgencyToken.js';
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
 * @param {number} props.agencyId  required
 */
export default function ProvisioningPanel({ agencyId }) {
  const {
    status,
    isLoading,
    error,
    generate,
    endToken,
    isGenerating,
    isEnding,
  } = useAgencyToken(agencyId);

  const [qrUrl, setQrUrl] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const token = status?.is_valid ? status.agency_token : null;

  // Render the QR image whenever a valid token is present.
  useEffect(() => {
    let cancelled = false;
    if (!token) {
      return;
    }
    QRCode.toDataURL(token, { width: 220, margin: 1 })
      .then((url) => {
        if (!cancelled) setQrUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleGenerate = async () => {
    setActionError(null);
    try {
      await generate();
    } catch (err) {
      setActionError(err);
    }
  };

  const runEnd = async () => {
    setActionError(null);
    try {
      await endToken();
      setConfirmEnd(false);
    } catch (err) {
      setActionError(err);
      setConfirmEnd(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-slate-400">Loading…</p>;
  }
  if (error) {
    return (
      <p className="text-sm text-red-600">
        {errMsg(error, 'Failed to load token status')}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {status?.is_valid ? (
        // ── Valid token: show QR + expiry + End ──
        <div className="flex flex-col items-center gap-3">
          {qrUrl ? (
            <img
              src={qrUrl}
              alt="Provisioning QR"
              className="rounded-lg border border-slate-200"
            />
          ) : (
            <p className="text-sm text-slate-400">Rendering QR…</p>
          )}
          <p className="text-xs text-slate-500">
            Valid until{' '}
            <span className="font-medium text-slate-700">
              {fmtDate(status.agency_token_expires_at)}
            </span>
          </p>
          <code className="rounded bg-slate-50 px-2 py-1 text-xs font-mono
                           text-slate-600 break-all max-w-full">
            {status.agency_token}
          </code>
          <button
            type="button"
            onClick={() => setConfirmEnd(true)}
            className="flex items-center gap-2 rounded-lg border border-red-200
                       px-3 py-2 text-sm font-medium text-red-600
                       hover:bg-red-50"
          >
            <Power size={16} />
            End token
          </button>
        </div>
      ) : (
        // ── No / expired token: Generate ──
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="flex h-14 w-14 items-center justify-center
                          rounded-full bg-slate-100">
            <QrCode size={26} className="text-slate-400" />
          </div>
          <p className="text-sm text-slate-500 text-center">
            {status?.agency_token_expires_at
              ? 'The previous token has ended. Generate a new one to allow device enrollment.'
              : 'No active token. Generate one to allow device enrollment.'}
          </p>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2
                       text-sm font-medium text-white hover:bg-brand-700
                       disabled:opacity-50"
          >
            <RefreshCw size={16} />
            {isGenerating ? 'Generating…' : 'Generate token'}
          </button>
        </div>
      )}

      {actionError ? (
        <p className="text-xs text-red-600 text-center">
          {errMsg(actionError, 'Action failed')}
        </p>
      ) : null}

      {confirmEnd ? (
        <ConfirmDialog
          title="End provisioning token"
          message="End the current token? Devices can no longer enroll until a new token is generated."
          confirmLabel="End token"
          danger
          isBusy={isEnding}
          onConfirm={runEnd}
          onCancel={() => setConfirmEnd(false)}
        />
      ) : null}
    </div>
  );
}
