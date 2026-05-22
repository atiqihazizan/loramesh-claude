// src/pages/LoginPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';
import Spinner from '../components/ui/Spinner.jsx';

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
      // Kalau wajib tukar password → terus ke settings
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
    <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 px-4">
      <div className="w-full max-w-sm">
        {/* Logo + nama */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-brand-600 flex items-center justify-center shadow-panel">
            <Radio size={28} className="text-white" />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-slate-800">
            LoRa Mesh
          </h1>
          <p className="text-sm text-slate-500">Monitoring & Tracking System</p>
        </div>

        {/* Borang */}
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="label">Username</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input
                className="input pr-10"
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={loading}
          >
            {loading ? <Spinner size={18} className="text-white" /> : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          LoRa Mesh Tracking · v3.0
        </p>
      </div>
    </div>
  );
}
