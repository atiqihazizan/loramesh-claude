// E3-e — device management page

import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { errMsg } from '../../lib/api.js';
import { useAuthStore } from '../../store/authStore.js';
import { useAgencies } from '../../hooks/useAgencies.js';
import { useAgencyDevices } from '../../hooks/useAgencyDevices.js';
import SettingsPageHeader from '../../components/settings/SettingsPageHeader.jsx';
import SettingsSection from '../../components/settings/SettingsSection.jsx';
import SuperadminAgencyPicker from '../../components/settings/SuperadminAgencyPicker.jsx';
import DataTable from '../../components/settings/DataTable.jsx';
import ConfirmDialog from '../../components/settings/ConfirmDialog.jsx';
import DeviceFormModal from '../../components/settings/DeviceFormModal.jsx';

export default function DevicesPage() {
  const isAgencyAdmin = useAuthStore((s) => s.isAgencyAdmin());
  const isSuperadmin = useAuthStore((s) => s.isSuperadmin());
  const { agencies, isLoading: agenciesLoading } = useAgencies();
  const [superadminAgencyId, setSuperadminAgencyId] = useState(null);
  const [search, setSearch] = useState('');

  const agencyTargetId = isSuperadmin
    ? superadminAgencyId ?? agencies[0]?.id ?? null
    : undefined;

  const {
    devices,
    isLoading,
    error,
    createDevice,
    updateDevice,
    removeDevice,
    isCreating,
    isUpdating,
    isRemoving,
  } = useAgencyDevices(agencyTargetId, search);

  const adminReady = !isSuperadmin || agencyTargetId != null;

  const [modal, setModal] = useState(null);
  const [formError, setFormError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [actionError, setActionError] = useState(null);

  if (!isAgencyAdmin) {
    return <Navigate to="/settings/account" replace />;
  }

  const columns = [
    { key: 'device_id', label: 'Device ID' },
    { key: 'name', label: 'Name' },
    {
      key: 'type',
      label: 'Type',
      render: (row) => row.type?.name ?? '—',
    },
    {
      key: 'is_static',
      label: 'Static',
      render: (row) => (row.is_static ? 'Yes' : 'No'),
    },
    { key: 'status', label: 'Status' },
  ];

  const runDelete = async () => {
    if (!confirmDelete) return;
    setActionError(null);
    try {
      await removeDevice(confirmDelete.id);
      setConfirmDelete(null);
    } catch (err) {
      setActionError(err);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        <SettingsPageHeader
          title="Devices"
          subtitle="Register and manage tracking devices for your agency."
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
          <SettingsSection
            title="Device list"
            description="Search by device ID, name, or MAC address."
          >
            <div className="flex justify-end mb-4">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setFormError(null);
                  setModal({ mode: 'create' });
                }}
              >
                <Plus size={18} />
                Add device
              </button>
            </div>

            {error ? <p className="text-sm text-red-600 mb-3">{errMsg(error)}</p> : null}
            {actionError && !confirmDelete ? (
              <p className="text-sm text-red-600 mb-3">{errMsg(actionError)}</p>
            ) : null}

            <DataTable
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search devices…"
              columns={columns}
              rows={devices}
              isLoading={isLoading}
              emptyMessage="No devices found"
              renderActions={(row) => (
                <>
                  <button
                    type="button"
                    title="Edit"
                    className="btn-ghost p-2"
                    onClick={() => {
                      setFormError(null);
                      setModal({ mode: 'edit', device: row });
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    className="btn-ghost p-2 text-red-600 hover:bg-red-50"
                    onClick={() => {
                      setActionError(null);
                      setConfirmDelete(row);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            />

            {modal ? (
              <DeviceFormModal
                key={modal.mode === 'create' ? 'create' : String(modal.device.id)}
                mode={modal.mode}
                device={modal.device}
                onClose={() => setModal(null)}
                onSubmitCreate={async (payload) => {
                  setFormError(null);
                  try {
                    await createDevice(payload);
                  } catch (err) {
                    setFormError(err);
                    throw err;
                  }
                }}
                onSubmitUpdate={async (id, patch) => {
                  setFormError(null);
                  try {
                    await updateDevice({ id, patch });
                  } catch (err) {
                    setFormError(err);
                    throw err;
                  }
                }}
                isSubmitting={isCreating || isUpdating}
                submitError={formError}
              />
            ) : null}

            {confirmDelete ? (
              <ConfirmDialog
                title="Delete device?"
                message={`"${confirmDelete.name}" (${confirmDelete.device_id}) will be removed permanently.`}
                confirmLabel="Delete"
                danger
                busy={isRemoving}
                onCancel={() => setConfirmDelete(null)}
                onConfirm={runDelete}
              />
            ) : null}
          </SettingsSection>
        ) : null}
      </div>
    </div>
  );
}
