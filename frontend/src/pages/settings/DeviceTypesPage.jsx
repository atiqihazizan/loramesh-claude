// E5-a — device types master page (superadmin)

import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { errMsg } from '../../lib/api.js';
import { useAuthStore } from '../../store/authStore.js';
import { useDeviceTypesCrud } from '../../hooks/useDeviceTypesCrud.js';
import SettingsPageHeader from '../../components/settings/SettingsPageHeader.jsx';
import DataTable from '../../components/settings/DataTable.jsx';
import ConfirmDialog from '../../components/settings/ConfirmDialog.jsx';
import DeviceTypeFormModal from '../../components/settings/DeviceTypeFormModal.jsx';
import Spinner from '../../components/ui/Spinner.jsx';

export default function DeviceTypesPage() {
  const isSuperadmin = useAuthStore((s) => s.isSuperadmin());
  const {
    types, isLoading, error,
    createType, updateType, removeType,
    isCreating, isUpdating, isRemoving,
  } = useDeviceTypesCrud();

  const [modal, setModal] = useState(null); // {mode:'create'} | {mode:'edit',type}
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

  const runDelete = async () => {
    if (!confirmDelete) return;
    setActionError(null);
    try {
      await removeType(confirmDelete.id);
      setConfirmDelete(null);
    } catch (err) {
      setActionError(errMsg(err, 'Failed to delete'));
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        <SettingsPageHeader
          title="Device types"
          subtitle="Master list of device categories. Affects all agencies."
        />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setModal({ mode: 'create' })}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2
                       text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus size={16} />
            New type
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
            {errMsg(error, 'Failed to load device types')}
          </p>
        ) : (
          <DataTable
            columns={columns}
            rows={types}
            renderActions={(row) => (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setModal({ mode: 'edit', type: row })}
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
        <DeviceTypeFormModal
          type={modal.mode === 'edit' ? modal.type : null}
          onSubmit={modal.mode === 'edit' ? updateType : createType}
          onClose={() => setModal(null)}
          isSaving={isCreating || isUpdating}
        />
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          title="Delete device type"
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
