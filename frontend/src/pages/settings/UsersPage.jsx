// E3-c — agency users management page

import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  KeyRound,
  Pencil,
  UserPlus,
  UserX,
} from 'lucide-react';
import { errMsg } from '../../lib/api.js';
import { useAuthStore } from '../../store/authStore.js';
import { useAgencies } from '../../hooks/useAgencies.js';
import { useAgencyUsers } from '../../hooks/useAgencyUsers.js';
import SuperadminAgencyPicker from '../../components/settings/SuperadminAgencyPicker.jsx';
import SettingsSection from '../../components/settings/SettingsSection.jsx';
import UserFormModal from '../../components/settings/UserFormModal.jsx';
import Spinner from '../../components/ui/Spinner.jsx';

function statusLabel(status) {
  if (status === 'disabled') return 'Disabled';
  if (status === 'online') return 'Online';
  if (status === 'offline') return 'Offline';
  if (status === 'banned') return 'Banned';
  return status || '—';
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
  busy,
  children,
}) {
  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-sm p-5 shadow-xl">
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

export default function UsersPage() {
  const isAgencyAdmin = useAuthStore((s) => s.isAgencyAdmin());
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isSuperadmin = useAuthStore((s) => s.isSuperadmin());
  const { agencies, isLoading: agenciesLoading } = useAgencies();
  const [superadminAgencyId, setSuperadminAgencyId] = useState(null);

  const agencyTargetId = isSuperadmin
    ? superadminAgencyId ?? agencies[0]?.id ?? null
    : undefined;

  const {
    users: allUsers,
    isLoading,
    error,
    createUser,
    updateUser,
    disableUser,
    resetPassword,
    isCreating,
    isUpdating,
    isDisabling,
    isResettingPassword,
  } = useAgencyUsers(agencyTargetId);

  const users = useMemo(
    () => allUsers.filter((u) => u.id !== currentUserId),
    [allUsers, currentUserId]
  );

  const adminReady = !isSuperadmin || agencyTargetId != null;

  const [modal, setModal] = useState(null);
  const [formError, setFormError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [confirmDisable, setConfirmDisable] = useState(null);
  const [confirmReset, setConfirmReset] = useState(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');

  if (!isAgencyAdmin) {
    return <Navigate to="/settings/account" replace />;
  }

  const openCreate = () => {
    setFormError(null);
    setModal({ mode: 'create' });
  };

  const openEdit = (user) => {
    setFormError(null);
    setModal({ mode: 'edit', user });
  };

  const handleCreate = async (payload) => {
    setFormError(null);
    try {
      await createUser(payload);
    } catch (err) {
      setFormError(err);
      throw err;
    }
  };

  const handleUpdate = async (id, patch) => {
    setFormError(null);
    try {
      await updateUser({ id, patch });
    } catch (err) {
      setFormError(err);
      throw err;
    }
  };

  const runDisable = async () => {
    if (!confirmDisable) return;
    setActionError(null);
    try {
      await disableUser(confirmDisable.id);
      setConfirmDisable(null);
    } catch (err) {
      setActionError(err);
    }
  };

  const runReset = async () => {
    if (!confirmReset) return;
    if (!resetPasswordValue || resetPasswordValue.length < 6) {
      setActionError(new Error('Password must be at least 6 characters'));
      return;
    }
    setActionError(null);
    try {
      await resetPassword({
        id: confirmReset.id,
        new_password: resetPasswordValue,
      });
      setConfirmReset(null);
      setResetPasswordValue('');
    } catch (err) {
      setActionError(err);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        <header>
          <h1 className="text-xl font-semibold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage accounts in your agency. Your own account is under My Account.
          </p>
        </header>

        {isSuperadmin ? (
          <SuperadminAgencyPicker
            agencyId={superadminAgencyId}
            onChange={setSuperadminAgencyId}
            agencies={agencies}
            isLoading={agenciesLoading}
          />
        ) : null}

        {adminReady ? (
          <SettingsSection
            title="Agency users"
            description="Create, edit, disable, or reset passwords for team members."
          >
            <div className="flex justify-end mb-4">
              <button type="button" className="btn-primary" onClick={openCreate}>
                <UserPlus size={18} />
                Add user
              </button>
            </div>

            {error ? (
              <p className="text-sm text-red-600 mb-3">{errMsg(error)}</p>
            ) : null}
            {actionError && !confirmDisable && !confirmReset ? (
              <p className="text-sm text-red-600 mb-3">{errMsg(actionError)}</p>
            ) : null}

            {isLoading ? (
              <div className="flex justify-center py-10">
                <Spinner size={28} className="text-brand-600" />
              </div>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm text-left min-w-[640px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 px-2 font-medium">Name</th>
                      <th className="py-2 px-2 font-medium">Username</th>
                      <th className="py-2 px-2 font-medium">Email</th>
                      <th className="py-2 px-2 font-medium">Role</th>
                      <th className="py-2 px-2 font-medium">Status</th>
                      <th className="py-2 px-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No other users in this agency
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => {
                        const disabled = u.status === 'disabled';
                        return (
                          <tr key={u.id} className="border-b border-slate-100">
                            <td className="py-2.5 px-2 text-slate-800">{u.name || '—'}</td>
                            <td className="py-2.5 px-2 text-slate-600">{u.username}</td>
                            <td className="py-2.5 px-2 text-slate-600">{u.email || '—'}</td>
                            <td className="py-2.5 px-2">{u.level?.name || '—'}</td>
                            <td className="py-2.5 px-2">
                              <span
                                className={
                                  disabled ? 'text-red-600' : 'text-slate-600'
                                }
                              >
                                {statusLabel(u.status)}
                              </span>
                            </td>
                            <td className="py-2.5 px-2">
                              <div className="flex justify-end gap-1">
                                <button
                                  type="button"
                                  title="Edit"
                                  className="btn-ghost p-2"
                                  onClick={() => openEdit(u)}
                                >
                                  <Pencil size={16} />
                                </button>
                                <button
                                  type="button"
                                  title="Reset password"
                                  className="btn-ghost p-2"
                                  disabled={disabled}
                                  onClick={() => {
                                    setActionError(null);
                                    setResetPasswordValue('');
                                    setConfirmReset(u);
                                  }}
                                >
                                  <KeyRound size={16} />
                                </button>
                                <button
                                  type="button"
                                  title="Disable user"
                                  className="btn-ghost p-2 text-red-600 hover:bg-red-50"
                                  disabled={disabled}
                                  onClick={() => {
                                    setActionError(null);
                                    setConfirmDisable(u);
                                  }}
                                >
                                  <UserX size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {modal ? (
              <UserFormModal
                key={modal.mode === 'create' ? 'create' : String(modal.user.id)}
                mode={modal.mode}
                user={modal.user}
                onClose={() => setModal(null)}
                onSubmitCreate={handleCreate}
                onSubmitUpdate={handleUpdate}
                isSubmitting={isCreating || isUpdating}
                submitError={formError}
              />
            ) : null}

            {confirmDisable ? (
              <ConfirmDialog
                title="Disable user?"
                message={`Account "${confirmDisable.username}" will be disabled and cannot sign in.`}
                confirmLabel="Disable"
                danger
                busy={isDisabling}
                onCancel={() => setConfirmDisable(null)}
                onConfirm={runDisable}
              />
            ) : null}

            {confirmReset ? (
              <ConfirmDialog
                title="Reset password"
                message={`Enter a new password for "${confirmReset.username}". They must change it on next sign-in.`}
                confirmLabel="Reset password"
                danger={false}
                busy={isResettingPassword}
                onCancel={() => {
                  setConfirmReset(null);
                  setResetPasswordValue('');
                }}
                onConfirm={runReset}
              >
                {actionError ? (
                  <p className="mt-2 text-sm text-red-600">{errMsg(actionError)}</p>
                ) : null}
                <div className="mt-3">
                  <label className="label" htmlFor="reset-pwd">
                    New password
                  </label>
                  <input
                    id="reset-pwd"
                    type="password"
                    className="input"
                    value={resetPasswordValue}
                    onChange={(e) => setResetPasswordValue(e.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                  />
                </div>
              </ConfirmDialog>
            ) : null}
          </SettingsSection>
        ) : null}
      </div>
    </div>
  );
}
