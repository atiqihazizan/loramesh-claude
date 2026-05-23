// E5-a — device types page (SUPERADMIN only)

import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { errMsg } from '../../lib/api.js';
import { useAuthStore } from '../../store/authStore.js';
import { useDeviceTypesCrud } from '../../hooks/useDeviceTypesCrud.js';
import SettingsPageHeader from '../../components/settings/SettingsPageHeader.jsx';
import SettingsSection from '../../components/settings/SettingsSection.jsx';
import DataTable from '../../components/settings/DataTable.jsx';
import ConfirmDialog from '../../components/settings/ConfirmDialog.jsx';
import DeviceTypeFormModal from '../../components/settings/DeviceTypeFormModal.jsx';

export default function DeviceTypesPage() {
  const isSuperadmin = useAuthStore((s) => s.isSuperadmin());
  const {
    deviceTypes,
    isLoading,
    error,
    createType,
    updateType,
    removeType,
    isCreating,
    isUpdating,
    isRemoving,
  } = useDeviceTypesCrud();

  const [modal, setModal] = useState(null);
  const [formError, setFormError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [actionError, setActionError] = useState(null);

  if (!isSuperadmin) {
    return <Navigate to="/settings/account" replace />;
  }

  const columns = [
    {
      key: 'color',
      label: '',
      render: (row) => (
        <span
          className="inline-block h-4 w-4 rounded-full border border-slate-200"
          style={{ backgroundColor: row.color_code || '#808080' }}
        />
      ),
    },
    { key: 'name', label: 'Name' },
    { key: 'code', label: 'Code' },
    { key: 'icon', label: 'Icon' },
    { key: 'device_count', label: 'Devices' },
  ];

  const handleSubmit = async (payload) => {
    setFormError(null);
    try {
      if (modal?.deviceType) {
        await updateType({ id: modal.deviceType.id, patch: payload });
      } else {
        await createType(payload);
      }
    } catch (err) {
      setFormError(err);
      throw err;
    }
  };

  const runDelete = async () => {
    if (!confirmDelete) return;
    setActionError(null);
    try {
      await removeType(confirmDelete.id);
      setConfirmDelete(null);
    } catch (err) {
      setActionError(err);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        <SettingsPageHeader
          title="Device types"
          subtitle="Master list of device types shared across all agencies."
        />

        <SettingsSection
          title="Device type definitions"
          description="Create, edit, or remove device types. A type in use cannot be deleted."
        >
          <div className="flex justify-end mb-3">
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setModal({ deviceType: null });
              }}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2
                         text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus size={16} />
              New device type
            </button>
          </div>

          {isLoading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : error ? (
            <p className="text-sm text-red-600">
              {errMsg(error, 'Failed to load device types')}
            </p>
          ) : (
            <DataTable
              columns={columns}
              rows={deviceTypes}
              renderActions={(row) => (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setFormError(null);
                      setModal({ deviceType: row });
                    }}
                    className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                    aria-label="Edit"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(row)}
                    className="rounded p-1.5 text-red-500 hover:bg-red-50"
                    aria-label="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            />
          )}

          {actionError ? (
            <p className="text-sm text-red-600 mt-2">
              {errMsg(actionError, 'Action failed')}
            </p>
          ) : null}
        </SettingsSection>
      </div>

      {modal ? (
        <DeviceTypeFormModal
          deviceType={modal.deviceType}
          onSubmit={handleSubmit}
          onClose={() => setModal(null)}
          isSaving={isCreating || isUpdating}
          error={formError}
        />
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          title="Delete device type"
          message={`Delete "${confirmDelete.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          isBusy={isRemoving}
          onConfirm={runDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      ) : null}
    </div>
  );
}
