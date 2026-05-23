// E3-b — agency settings page (map, tracking, session)

import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { errMsg } from '../../lib/api.js';
import { useAuthStore } from '../../store/authStore.js';
import { useAgencies } from '../../hooks/useAgencies.js';
import { useAgencySettings } from '../../hooks/useAgencySettings.js';
import SuperadminAgencyPicker from '../../components/settings/SuperadminAgencyPicker.jsx';
import SettingsPageHeader from '../../components/settings/SettingsPageHeader.jsx';
import SettingsSection from '../../components/settings/SettingsSection.jsx';
import AgencySettingsForm from '../../components/settings/AgencySettingsForm.jsx';
import ProvisioningPanel from '../../components/settings/ProvisioningPanel.jsx';

export default function AgencySettingsPage() {
  const isAgencyAdmin = useAuthStore((s) => s.isAgencyAdmin());
  const isSuperadmin = useAuthStore((s) => s.isSuperadmin());
  const { agencies, isLoading: agenciesLoading } = useAgencies();
  const [superadminAgencyId, setSuperadminAgencyId] = useState(null);

  const agencyTargetId = isSuperadmin
    ? superadminAgencyId ?? agencies[0]?.id ?? null
    : undefined;

  const agencySettings = useAgencySettings(agencyTargetId);
  const adminReady = !isSuperadmin || agencyTargetId != null;

  if (!isAgencyAdmin) {
    return <Navigate to="/settings/account" replace />;
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        <SettingsPageHeader
          title="Agency settings"
          subtitle="Default map, follow-camera tracking, and session timeout for your agency."
        />

        {isSuperadmin ? (
          <SuperadminAgencyPicker
            agencyId={superadminAgencyId}
            onChange={setSuperadminAgencyId}
            agencies={agencies}
            isLoading={agenciesLoading}
          />
        ) : null}

        {adminReady ? (
          agencySettings.isError ? (
            <p className="text-sm text-red-600">
              {errMsg(agencySettings.error, 'Failed to load agency settings')}
            </p>
          ) : (
            <AgencySettingsForm
              agency={agencySettings.agency}
              isLoading={agencySettings.isLoading}
              updateAgency={agencySettings.updateAgency}
              isSaving={agencySettings.isSaving}
              saveError={agencySettings.saveError}
            />
          )
        ) : null}

        <SettingsSection
          title="Device provisioning"
          description="Generate enrollment codes for new devices to join this agency."
        >
          <ProvisioningPanel />
        </SettingsSection>
      </div>
    </div>
  );
}
