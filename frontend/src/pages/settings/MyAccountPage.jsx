// E3-d — signed-in user profile (read-only; no PATCH /auth/me in backend)
// TODO: profile update — needs backend PATCH /auth/me

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useAuthStore } from '../../store/authStore.js';
import SettingsSection from '../../components/settings/SettingsSection.jsx';
import ChangePasswordModal from '../../components/settings/ChangePasswordModal.jsx';

function ProfileField({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-800">{value || '—'}</dd>
    </div>
  );
}

export default function MyAccountPage() {
  const user = useAuthStore((s) => s.user);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);

  if (!user) {
    return (
      <div className="p-8 text-sm text-slate-500">Loading account…</div>
    );
  }

  const agencyLabel = user.agency
    ? `${user.agency.name} (${user.agency.code})`
    : '—';

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        <header>
          <h1 className="text-xl font-semibold text-slate-900">My account</h1>
          <p className="text-sm text-slate-500 mt-1">
            Your profile and password. Contact an agency admin to change role or username.
          </p>
        </header>

        {successMsg ? (
          <p className="text-sm text-brand-700 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2">
            {successMsg}
          </p>
        ) : null}

        <SettingsSection
          title="Profile"
          description="Read-only — backend has no self-service profile update endpoint yet."
        >
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ProfileField label="Name" value={user.name} />
            <ProfileField label="Username" value={user.username} />
            <ProfileField label="Email" value={user.email} />
            <ProfileField label="Phone" value={user.phone_number} />
            <ProfileField label="Role" value={user.level?.name} />
            <ProfileField label="Agency" value={agencyLabel} />
          </dl>
        </SettingsSection>

        <SettingsSection title="Security" description="Update your sign-in password.">
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setSuccessMsg(null);
              setPwdOpen(true);
            }}
          >
            <KeyRound size={18} />
            Change password
          </button>
        </SettingsSection>

        {pwdOpen ? (
          <ChangePasswordModal
            onClose={() => setPwdOpen(false)}
            onSuccess={() =>
              setSuccessMsg(
                'Password updated successfully. You may need to sign in again on other devices.'
              )
            }
          />
        ) : null}
      </div>
    </div>
  );
}
