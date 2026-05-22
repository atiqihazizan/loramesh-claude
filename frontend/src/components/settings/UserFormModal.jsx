// E3-c — create / edit agency user modal

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Eye, EyeOff } from 'lucide-react';
import { api, errMsg } from '../../lib/api.js';
import { useAuthStore } from '../../store/authStore.js';
import Spinner from '../ui/Spinner.jsx';

const ROLE_RANK = {
  SUPERADMIN: 100,
  ADMIN_AGENCY: 50,
  USER_AGENCY: 10,
  VIEWER: 1,
};

async function fetchLevels() {
  const res = await api.get('/users/levels');
  return res.data?.levels ?? [];
}

function emptyCreateForm() {
  return {
    username: '',
    password: '',
    name: '',
    email: '',
    phone_number: '',
    level_id: '',
  };
}

function userToEditForm(user) {
  return {
    username: user.username,
    name: user.name || '',
    email: user.email || '',
    phone_number: user.phone_number || '',
    level_id: user.level?.id ? String(user.level.id) : '',
  };
}

function initialForm(mode, user) {
  if (mode === 'edit' && user) return userToEditForm(user);
  return emptyCreateForm();
}

export default function UserFormModal({
  mode,
  user,
  onClose,
  onSubmitCreate,
  onSubmitUpdate,
  isSubmitting,
  submitError,
}) {
  const actorCode = useAuthStore((s) => s.user?.level?.code);
  const [form, setForm] = useState(() => initialForm(mode, user));
  const [showPwd, setShowPwd] = useState(false);
  const [localError, setLocalError] = useState(null);

  const levelsQuery = useQuery({
    queryKey: ['users', 'levels'],
    queryFn: fetchLevels,
    staleTime: 10 * 60 * 1000,
  });

  const assignableLevels = useMemo(() => {
    const actorRank = ROLE_RANK[actorCode] || 0;
    return (levelsQuery.data ?? []).filter(
      (lv) =>
        lv.code !== 'SUPERADMIN' && (ROLE_RANK[lv.code] || 0) <= actorRank
    );
  }, [levelsQuery.data, actorCode]);

  const defaultLevelId = useMemo(() => {
    const def =
      assignableLevels.find((l) => l.code === 'USER_AGENCY') ||
      assignableLevels[0];
    return def ? String(def.id) : '';
  }, [assignableLevels]);

  const levelValue = form.level_id || defaultLevelId;

  const setField = (key, value) => {
    setLocalError(null);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);

    if (mode === 'create') {
      if (!form.username.trim() || form.username.trim().length < 3) {
        setLocalError('Username must be at least 3 characters');
        return;
      }
      if (!form.password || form.password.length < 6) {
        setLocalError('Password must be at least 6 characters');
        return;
      }
      const payload = {
        username: form.username.trim(),
        password: form.password,
        name: form.name.trim() || undefined,
        email: form.email.trim() || undefined,
        phone_number: form.phone_number.trim() || undefined,
      };
      if (levelValue) payload.level_id = Number(levelValue);
      try {
        await onSubmitCreate(payload);
        onClose();
      } catch {
        // submitError shown below
      }
      return;
    }

    const patch = {};
    if (form.name !== (user.name || '')) patch.name = form.name.trim() || null;
    if (form.email !== (user.email || '')) patch.email = form.email.trim() || null;
    if (form.phone_number !== (user.phone_number || '')) {
      patch.phone_number = form.phone_number.trim() || null;
    }
    const newLevelId = levelValue ? Number(levelValue) : null;
    if (newLevelId && newLevelId !== user.level?.id) {
      patch.level_id = newLevelId;
    }
    if (Object.keys(patch).length === 0) {
      setLocalError('No changes to save');
      return;
    }
    try {
      await onSubmitUpdate(user.id, patch);
      onClose();
    } catch {
      // submitError
    }
  };

  const displayError =
    localError || (submitError ? errMsg(submitError) : null);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="card w-full max-w-md max-h-[90vh] overflow-y-auto p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-800">
            {mode === 'create' ? 'Add user' : 'Edit user'}
          </h3>
          <button type="button" className="btn-ghost p-2" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {displayError ? (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {displayError}
            </p>
          ) : null}

          {mode === 'create' ? (
            <div>
              <label className="label" htmlFor="uf-username">
                Username
              </label>
              <input
                id="uf-username"
                className="input"
                value={form.username}
                onChange={(e) => setField('username', e.target.value)}
                required
                autoComplete="off"
              />
            </div>
          ) : (
            <div>
              <label className="label">Username</label>
              <p className="text-sm text-slate-600 py-2">{form.username}</p>
            </div>
          )}

          {mode === 'create' ? (
            <div>
              <label className="label" htmlFor="uf-password">
                Password
              </label>
              <div className="relative">
                <input
                  id="uf-password"
                  className="input pr-10"
                  type={showPwd ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setField('password', e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
                  onClick={() => setShowPwd((v) => !v)}
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          ) : null}

          <div>
            <label className="label" htmlFor="uf-name">
              Name
            </label>
            <input
              id="uf-name"
              className="input"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="uf-email">
              Email
            </label>
            <input
              id="uf-email"
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="uf-phone">
              Phone
            </label>
            <input
              id="uf-phone"
              className="input"
              value={form.phone_number}
              onChange={(e) => setField('phone_number', e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="uf-level">
              Role
            </label>
            <select
              id="uf-level"
              className="input"
              value={levelValue}
              onChange={(e) => setField('level_id', e.target.value)}
              disabled={levelsQuery.isLoading}
            >
              {assignableLevels.map((lv) => (
                <option key={lv.id} value={lv.id}>
                  {lv.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <Spinner size={18} className="text-white" />
              ) : mode === 'create' ? (
                'Create user'
              ) : (
                'Save'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
