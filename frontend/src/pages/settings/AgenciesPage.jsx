// E5-b1 — agencies list page (SUPERADMIN only)

import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Pencil, Plus, Power, QrCode } from 'lucide-react';
import { errMsg } from '../../lib/api.js';
import { useAuthStore } from '../../store/authStore.js';
import { useAgenciesCrud } from '../../hooks/useAgenciesCrud.js';
import SettingsPageHeader from '../../components/settings/SettingsPageHeader.jsx';
import SettingsSection from '../../components/settings/SettingsSection.jsx';
import DataTable from '../../components/settings/DataTable.jsx';
import ConfirmDialog from '../../components/settings/ConfirmDialog.jsx';
import AgencyFormModal from '../../components/settings/AgencyFormModal.jsx';
import ProvisioningPanel from '../../components/settings/ProvisioningPanel.jsx';

export default function AgenciesPage() {
  const isSuperadmin = useAuthStore((s) => s.isSuperadmin());
  const {
    agencies,
    isLoading,
    error,
    createAgency,
    updateAgency,
    disableAgency,
    isCreating,
    isUpdating,
    isDisabling,
  } = useAgenciesCrud();

  const [modal, setModal] = useState(null);
  const [formError, setFormError] = useState(null);
  const [confirmDisable, setConfirmDisable] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [provisionFor, setProvisionFor] = useState(null);

  if (!isSuperadmin) {
    return <Navigate to="/settings/account" replace />;
  }

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'code', label: 'Code' },
    {
      key: 'status',
      label: 'Status',
      render: (row) =>
        row.status ? (
          <span className="text-green-600 text-xs font-medium">Active</span>
        ) : (
          <span className="text-slate-400 text-xs font-medium">Inactive</span>
        ),
    },
  ];

  const handleSubmit = async (payload) => {
    setFormError(null);
    try {
      if (modal?.agency) {
        await updateAgency({ id: modal.agency.id, patch: payload });
      } else {
        await createAgency(payload);
      }
    } catch (err) {
      setFormError(err);
      throw err;
    }
  };

  const runDisable = async () => {
    if (!confirmDisable) return;
    setActionError(null);
    try {
      await disableAgency(confirmDisable.id);
      setConfirmDisable(null);
    } catch (err) {
      setActionError(err);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        <SettingsPageHeader
          title="Agencies"
          subtitle="Create and manage agencies across the system."
        />

        <SettingsSection
          title="Agency list"
          description="Create, edit, or deactivate agencies."
        >
          <div className="flex justify-end mb-3">
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setModal({ agency: null });
              }}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2
                         text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus size={16} />
              New agency
            </button>
          </div>

          {isLoading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : error ? (
            <p className="text-sm text-red-600">
              {errMsg(error, 'Failed to load agencies')}
            </p>
          ) : (
            <DataTable
              columns={columns}
              rows={agencies}
              renderActions={(row) => (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setProvisionFor(row)}
                    className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                    aria-label="Provisioning"
                  >
                    <QrCode size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormError(null);
                      setModal({ agency: row });
                    }}
                    className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                    aria-label="Edit"
                  >
                    <Pencil size={15} />
                  </button>
                  {row.status ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDisable(row)}
                      className="rounded p-1.5 text-red-500 hover:bg-red-50"
                      aria-label="Deactivate"
                    >
                      <Power size={15} />
                    </button>
                  ) : null}
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
        <AgencyFormModal
          agency={modal.agency}
          onSubmit={handleSubmit}
          onClose={() => setModal(null)}
          isSaving={isCreating || isUpdating}
          error={formError}
        />
      ) : null}

      {confirmDisable ? (
        <ConfirmDialog
          title="Deactivate agency"
          message={`Deactivate "${confirmDisable.name}"?`}
          confirmLabel="Deactivate"
          danger
          isBusy={isDisabling}
          onConfirm={runDisable}
          onCancel={() => setConfirmDisable(null)}
        />
      ) : null}

      {provisionFor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <h3 className="text-sm font-semibold text-slate-800">
                Provisioning — {provisionFor.name}
              </h3>
              <button
                type="button"
                onClick={() => setProvisionFor(null)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="px-5 py-4">
              <ProvisioningPanel agencyId={provisionFor.id} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
