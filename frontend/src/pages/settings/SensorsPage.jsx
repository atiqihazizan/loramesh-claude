// E5-a — master sensors page (superadmin)

import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { errMsg } from '../../lib/api.js';
import { useAuthStore } from '../../store/authStore.js';
import { useMasterSensors } from '../../hooks/useMasterSensors.js';
import SettingsPageHeader from '../../components/settings/SettingsPageHeader.jsx';
import DataTable from '../../components/settings/DataTable.jsx';
import ConfirmDialog from '../../components/settings/ConfirmDialog.jsx';
import SensorFormModal from '../../components/settings/SensorFormModal.jsx';
import Spinner from '../../components/ui/Spinner.jsx';

export default function SensorsPage() {
  const isSuperadmin = useAuthStore((s) => s.isSuperadmin());
  const {
    sensors, isLoading, error,
    createSensor, updateSensor, removeSensor,
    isCreating, isUpdating, isRemoving,
  } = useMasterSensors();

  const [modal, setModal] = useState(null);
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
      render: (row) => {
        const lo = row.min_value ?? '—';
        const hi = row.max_value ?? '—';
        return `${lo} – ${hi}`;
      },
    },
  ];

  const runDelete = async () => {
    if (!confirmDelete) return;
    setActionError(null);
    try {
      await removeSensor(confirmDelete.id);
      setConfirmDelete(null);
    } catch (err) {
      setActionError(errMsg(err, 'Failed to delete'));
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        <SettingsPageHeader
          title="Sensors"
          subtitle="Master list of sensor definitions. Affects all agencies."
        />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setModal({ mode: 'create' })}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2
                       text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus size={16} />
            New sensor
          </button>
        </div>

        {actionError ? (
          <p className="text-sm text-red-600">{actionError}</p>
        ) : null}

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner size={24} />
          </div>
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
                  onClick={() => setModal({ mode: 'edit', sensor: row })}
                  className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                  title="Edit"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => setConfirmDelete(row)}
                  className="rounded p-1.5 text-red-500 hover:bg-red-50"
                  title="Delete"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )}
          />
        )}
      </div>

      {modal ? (
        <SensorFormModal
          sensor={modal.mode === 'edit' ? modal.sensor : null}
          onSubmit={modal.mode === 'edit' ? updateSensor : createSensor}
          onClose={() => setModal(null)}
          isSaving={isCreating || isUpdating}
        />
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          title="Delete sensor"
          message={`Delete "${confirmDelete.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={runDelete}
          onCancel={() => setConfirmDelete(null)}
          busy={isRemoving}
        />
      ) : null}
    </div>
  );
}
