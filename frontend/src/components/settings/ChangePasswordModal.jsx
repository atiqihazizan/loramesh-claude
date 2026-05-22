// E3-d — self-service password change (POST /auth/password)

import { useState } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import { api, errMsg } from '../../lib/api.js';
import Spinner from '../ui/Spinner.jsx';

export default function ChangePasswordModal({ onClose, onSuccess }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const resetFields = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setLocalError(null);
  };

  const handleClose = () => {
    resetFields();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);

    if (!currentPassword) {
      setLocalError('Enter your current password');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setLocalError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError('New passwords do not match');
      return;
    }
    if (currentPassword === newPassword) {
      setLocalError('New password must differ from current password');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/auth/password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      resetFields();
      onSuccess?.();
      onClose();
    } catch (err) {
      setLocalError(errMsg(err, 'Failed to change password'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-pwd-title"
    >
      <div className="card w-full max-w-md p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 id="change-pwd-title" className="text-base font-semibold text-slate-800">
            Change password
          </h3>
          <button type="button" className="btn-ghost p-2" onClick={handleClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {localError ? (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {localError}
            </p>
          ) : null}

          <div>
            <label className="label" htmlFor="cp-current">
              Current password
            </label>
            <div className="relative">
              <input
                id="cp-current"
                className="input pr-10"
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
                onClick={() => setShowCurrent((v) => !v)}
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="cp-new">
              New password
            </label>
            <div className="relative">
              <input
                id="cp-new"
                className="input pr-10"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={6}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
                onClick={() => setShowNew((v) => !v)}
                tabIndex={-1}
              >
                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="cp-confirm">
              Confirm new password
            </label>
            <input
              id="cp-confirm"
              className="input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? (
                <Spinner size={18} className="text-white" />
              ) : (
                'Update password'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
