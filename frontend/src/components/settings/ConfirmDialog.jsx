// E3-a — destructive / sensitive action confirmation

import Spinner from '../ui/Spinner.jsx';

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger = false,
  onCancel,
  onConfirm,
  busy,
  children,
}) {
  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/40 p-4">
      <div className="rounded-xl border border-slate-200 bg-white w-full max-w-sm p-5 shadow-xl">
        <h3 className="text-base font-semibold text-slate-800">{title}</h3>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        {children}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={danger ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? <Spinner size={18} className="text-white" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
