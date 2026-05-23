// E3-a — empty collection placeholder with optional CTA

export default function EmptyState({ icon: Icon, message, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {Icon ? (
        <Icon size={48} className="text-slate-200 mb-4" strokeWidth={1.25} aria-hidden />
      ) : null}
      <p className="text-sm text-slate-500 max-w-sm">{message}</p>
      {actionLabel && onAction ? (
        <button type="button" className="btn-primary mt-4" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
