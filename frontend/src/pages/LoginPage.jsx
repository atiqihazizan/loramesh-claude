// src/pages/LoginPage.jsx — split desktop · mobile header warna + form plain

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, User, Lock, MapPin, Radio, Activity } from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';
import Spinner from '../components/ui/Spinner.jsx';
import AppLogo from '../components/ui/AppLogo.jsx';

const BG = 'url(/bg.webp)';

const FEATURES = [
  { icon: MapPin, label: 'Live tracking' },
  { icon: Radio, label: 'LoRa mesh' },
  { icon: Activity, label: 'Real-time alerts' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await login(username.trim(), password);
    setLoading(false);

    if (result.ok) {
      if (result.user?.must_change_password) {
        navigate('/settings?tab=account&forced=1');
      } else {
        navigate('/');
      }
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="relative grid min-h-full w-full lg:grid-cols-[minmax(0,1.22fr)_minmax(0,0.67fr)]" style={{ backgroundImage: BG , backgroundSize:'100% 100%'}}>
      <aside className="relative hidden min-h-[280px] flex-col justify-between overflow-hidden lg:flex lg:min-h-full">
        <div
          className="absolute inset-0 bg-gradient-to-br from-emerald-950/75 via-slate-900/45 to-emerald-900/30"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-emerald-950/80 via-transparent to-emerald-950/25"
          aria-hidden
        />

        <div className="relative z-10 p-10 xl:p-14">
          <AppLogo className="h-12 w-auto max-w-[200px] object-contain brightness-0 invert drop-shadow-md" />
        </div>

        <div className="relative z-10 max-w-md space-y-8 px-10 pb-4 xl:px-14">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/95">
              Wireless / LoRa
            </p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-white drop-shadow-sm xl:text-[2rem]">
              Field sensors and mesh gateways, mapped in one place.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-emerald-50/85 xl:text-base">
              The same network view you deploy outdoors — now on your operations dashboard.
            </p>
          </div>

          <ul className="space-y-2.5">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-3 rounded-xl border border-white/15 bg-black/25 px-4 py-2.5 text-sm text-white/95 backdrop-blur-md"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white">
                  <Icon size={16} strokeWidth={2} />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 px-10 pb-8 text-xs text-white/50 xl:px-14 xl:pb-10">
          © 2026 LoRaMesh Pro. All rights reserved.
        </p>
      </aside>

      <main className="relative flex min-h-full flex-col overflow-hidden bg-white lg:bg-transparent">
        {/* <div
          className="absolute inset-0 hidden bg-cover bg-no-repeat bg-[88%_center] lg:block lg:bg-[length:185%_auto] lg:bg-[92%_center]"
          // style={{ backgroundImage: BG }}
          aria-hidden
        /> */}
        {/* <div
          className="absolute inset-0 hidden lg:block lg:bg-gradient-to-l lg:from-white/96 lg:via-white/90 lg:to-white/75 lg:backdrop-blur-[1px]"
          aria-hidden
        /> */}

        <form onSubmit={handleSubmit} className="relative z-10 flex min-h-full flex-col bg-white">
          <header className="login-mobile-header shrink-0 lg:hidden">
            <AppLogo className="h-10 w-auto max-w-[190px] object-contain brightness-0 invert" />
            <p className="mt-2 text-sm text-emerald-100/90">Monitoring &amp; Tracking System</p>
          </header>

          <div className="flex flex-1 flex-col justify-center px-5 py-6 sm:px-6 lg:items-center lg:px-12 lg:py-8 xl:px-14">
            <div className="login-form-panel1 mx-auto w-full max-w-[360px] lg:max-w-[440px]">
              <div className="mb-6 lg:hidden">
                <h1 className="text-xl font-semibold tracking-tight text-slate-900">Sign in</h1>
                <p className="mt-1 text-sm text-slate-500">Use your operator credentials</p>
              </div>

              <div className="login-enter hidden lg:block lg:px-6 lg:pt-6">
                <AppLogo className="mb-6 h-10 w-auto max-w-[180px] object-contain" />
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
                  Internet / Cloud
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.75rem]">
                  Sign in to Cloud Platform
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Use your operator credentials to open the live map and device dashboard.
                </p>
                <br />
              </div>

              <div className="space-y-4 lg:space-y-5 lg:px-6 lg:pb-6 lg:pt-0">
                <div>
                  <label className="label text-slate-600" htmlFor="login-username">
                    Username
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <User size={18} strokeWidth={2} />
                    </span>
                    <input
                      id="login-username"
                      className="input login-field pl-10"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                      autoFocus
                      placeholder="your.username"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="label text-slate-600" htmlFor="login-password">
                    Password
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <Lock size={18} strokeWidth={2} />
                    </span>
                    <input
                      id="login-password"
                      className="input login-field pl-10 pr-11"
                      type={showPwd ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                      aria-label={showPwd ? 'Hide password' : 'Show password'}
                    >
                      {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {error ? (
                  <div
                    className="rounded-xl border border-red-200/80 bg-red-50 px-3.5 py-3 text-sm text-red-800"
                    role="alert"
                  >
                    <span className="font-medium">Could not sign in.</span>{' '}
                    <span className="text-red-700">{error}</span>
                  </div>
                ) : null}

                <button
                  type="submit"
                  className="btn-primary login-submit w-full py-3 text-[15px] font-semibold"
                  disabled={loading}
                >
                  {loading ? <Spinner size={18} className="text-white" /> : 'Sign in'}
                </button>
              </div>
            </div>

            <ul className="mx-auto mt-6 flex w-full max-w-[360px] justify-between gap-2 lg:hidden">
              {FEATURES.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="flex flex-1 flex-col items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2.5 text-center"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-brand-600 shadow-sm ring-1 ring-slate-200/80">
                    <Icon size={15} strokeWidth={2.2} />
                  </span>
                  <span className="text-[10px] font-medium leading-tight text-slate-600">{label}</span>
                </li>
              ))}
            </ul>
          </div>

          <footer className="shrink-0 pb-6 text-center lg:hidden">
            <p className="text-xs text-slate-400">© 2026 LoRaMesh Pro</p>
          </footer>
        </form>
      </main>
    </div>
  );
}
