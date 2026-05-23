// E5-a — master sensors page (SUPERADMIN only)

import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { errMsg } from '../../lib/api.js';
import { useAuthStore } from '../../store/authStore.js';
import { useMasterSensors } from '../../hooks/useMasterSensors.js';
import SettingsPageHeader from '../../components/settings/SettingsPageHeader.jsx';
import SettingsSection from '../../components/settings/SettingsSection.jsx';
import DataTable from '../../components/settings/DataTable.jsx';
import ConfirmDialog from '../../components/settings/ConfirmDialog.jsx';
import SensorFormModal from '../../components/settings/SensorFormModal.jsx';

export default function SensorsPage() {
  const isSuperadmin = useAuthStore((s) => s.isSuperadmin());
  const {
    sensors,
    isLoading,
    error,
    createSensor,
    updateSensor,
    removeSensor,
    isCreating,
    isUpdating,
    isRemoving,
  } = useMasterSensors();

  const [modal, setModal] = useState(null);
  const [formError, setFormError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [actionError, setActionError] = useState(null);

  if (!isSuperadmin) {
    return <Navigate to="/settings/account" replace />;
  }

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'short_name', label: 'Short name' },
    { key: 'unit', label: 'Unit' },
    {
      key: 'range',
      label: 'Range',
      render: (row) =>
        row.min_value != null || row.max_value != null
          ? `${row.min_value ?? '—'} … ${row.max_value ?? '—'}`
          : '—',
    },
  ];

  const handleSubmit = async (payload) => {
    setFormError(null);
    try {
      if (modal?.sensor) {
        await updateSensor({ id: modal.sensor.id, patch: payload });
      } else {
        await createSensor(payload);
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
      await removeSensor(confirmDelete.id);
      setConfirmDelete(null);
    } catch (err) {
      setActionError(err);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        <SettingsPageHeader
          title="Sensors"
          subtitle="Master list of sensor definitions shared across all agencies."
        />

        <SettingsSection
          title="Sensor definitions"
          description="Create, edit, or remove master sensor types."
        >
          <div className="flex justify-end mb-3">
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setModal({ sensor: null });
              }}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2
                         text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus size={16} />
              New sensor
            </button>
          </div>

          {isLoading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : error ? (
            <p className="text-sm text-red-600">
              {errMsg(error, 'Failed to load sensors')}
            </p>
          ) : (
            <DataTable
              columns={columns}
              rows={sensors}
              renderActions={(row) => (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setFormError(null);
                      setModal({ sensor: row });
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
        <SensorFormModal
          sensor={modal.sensor}
          onSubmit={handleSubmit}
          onClose={() => setModal(null)}
          isSaving={isCreating || isUpdating}
          error={formError}
        />
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          title="Delete sensor"
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
