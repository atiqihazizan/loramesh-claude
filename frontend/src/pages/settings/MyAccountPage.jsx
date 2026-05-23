// E3-d — my account (profile edit + change password)

import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Save, User } from 'lucide-react';
import { errMsg } from '../../lib/api.js';
import { useMyProfile } from '../../hooks/useMyProfile.js';
import SettingsPageHeader from '../../components/settings/SettingsPageHeader.jsx';
import SettingsSection from '../../components/settings/SettingsSection.jsx';
import ChangePasswordModal from '../../components/settings/ChangePasswordModal.jsx';
import Spinner from '../../components/ui/Spinner.jsx';

function profileToForm(user) {
  return {
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone_number: user?.phone_number ?? '',
  };
}

export default function MyAccountPage() {
  const { user, updateProfile, isSaving, saveError } = useMyProfile();
  const [form, setForm] = useState(() => profileToForm(user));
  const [baseline, setBaseline] = useState(() => profileToForm(user));
  const [saved, setSaved] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    const next = profileToForm(user);
    setForm(next);
    setBaseline(next);
  }, [user?.id, user?.name, user?.email, user?.phone_number]);

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(baseline),
    [form, baseline]
  );

  if (!user) {
    return (
      <div className="p-8 text-sm text-slate-500">Loading account…</div>
    );
  }

  const agencyLabel = user.agency
    ? `${user.agency.name} (${user.agency.code})`
    : '—';

  const setField = (key, value) => {
    setSaved(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaved(false);
    const patch = {};
    if (form.name !== baseline.name) patch.name = form.name.trim();
    if (form.email !== baseline.email) patch.email = form.email.trim() || null;
    if (form.phone_number !== baseline.phone_number) {
      patch.phone_number = form.phone_number.trim() || null;
    }
    if (Object.keys(patch).length === 0) return;

    try {
      await updateProfile(patch);
      setBaseline({ ...form });
      setSaved(true);
      setSuccessMsg(null);
    } catch {
      /* saveError shown below */
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        <SettingsPageHeader
          title="My account"
          subtitle="Your profile and password. Contact an agency admin to change role or username."
        />

        {successMsg ? (
          <p className="text-sm text-brand-700 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2">
            {successMsg}
          </p>
        ) : null}
        {saved ? (
          <p className="text-sm text-brand-700 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2">
            Profile saved.
          </p>
        ) : null}

        <SettingsSection
          title="Profile"
          description="Update your contact details."
        >
          <form onSubmit={handleSave} className="space-y-4">
            {saveError ? (
              <p className="text-sm text-red-600">{errMsg(saveError)}</p>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="acc-name">
                  Name
                </label>
                <input
                  id="acc-name"
                  className="input"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="acc-email">
                  Email
                </label>
                <input
                  id="acc-email"
                  type="email"
                  className="input"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="acc-phone">
                  Phone
                </label>
                <input
                  id="acc-phone"
                  className="input"
                  value={form.phone_number}
                  onChange={(e) => setField('phone_number', e.target.value)}
                />
              </div>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div>
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Username
                </dt>
                <dd className="mt-1 text-sm text-slate-800">{user.username}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Role
                </dt>
                <dd className="mt-1 text-sm text-slate-800">{user.level?.name ?? '—'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Agency
                </dt>
                <dd className="mt-1 text-sm text-slate-800">{agencyLabel}</dd>
              </div>
            </dl>

            <div className="flex justify-end pt-2">
              <button type="submit" className="btn-primary" disabled={!dirty || isSaving}>
                {isSaving ? (
                  <Spinner size={18} className="text-white" />
                ) : (
                  <>
                    <Save size={18} />
                    Save profile
                  </>
                )}
              </button>
            </div>
          </form>
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

        <div className="flex items-center gap-2 text-xs text-slate-400 px-1">
          <User size={14} aria-hidden />
          <span>Account ID {user.id}</span>
        </div>

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
