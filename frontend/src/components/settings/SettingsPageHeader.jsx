// E3-a — page title + subtitle for settings sub-pages

export default function SettingsPageHeader({ title, subtitle }) {
  return (
    <header>
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      {subtitle ? <p className="text-sm text-slate-500 mt-1">{subtitle}</p> : null}
    </header>
  );
}
