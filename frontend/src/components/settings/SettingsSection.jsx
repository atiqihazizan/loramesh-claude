// E3-a — settings section card (title + content)

export default function SettingsSection({ title, description, children }) {
  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
