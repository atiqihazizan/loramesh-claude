// E3-f — site management page (card grid)

import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Globe, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { errMsg } from '../../lib/api.js';
import { useAuthStore } from '../../store/authStore.js';
import { useAgencies } from '../../hooks/useAgencies.js';
import { useAgencySites } from '../../hooks/useAgencySites.js';
import SettingsPageHeader from '../../components/settings/SettingsPageHeader.jsx';
import SuperadminAgencyPicker from '../../components/settings/SuperadminAgencyPicker.jsx';
import EmptyState from '../../components/settings/EmptyState.jsx';
import ConfirmDialog from '../../components/settings/ConfirmDialog.jsx';
import SiteFormModal from '../../components/settings/SiteFormModal.jsx';
import Spinner from '../../components/ui/Spinner.jsx';

export default function SitesPage() {
  const isAgencyAdmin = useAuthStore((s) => s.isAgencyAdmin());
  const isSuperadmin = useAuthStore((s) => s.isSuperadmin());
  const { agencies, isLoading: agenciesLoading } = useAgencies();
  const [superadminAgencyId, setSuperadminAgencyId] = useState(null);

  const agencyTargetId = isSuperadmin
    ? superadminAgencyId ?? agencies[0]?.id ?? null
    : undefined;

  const {
    sites,
    isLoading,
    error,
    createSite,
    updateSite,
    removeSite,
    isCreating,
    isUpdating,
    isRemoving,
  } = useAgencySites(agencyTargetId);

  const adminReady = !isSuperadmin || agencyTargetId != null;

  const [modal, setModal] = useState(null);
  const [formError, setFormError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [actionError, setActionError] = useState(null);

  if (!isAgencyAdmin) {
    return <Navigate to="/settings/account" replace />;
  }

  const togglePublish = async (site) => {
    setActionError(null);
    try {
      await updateSite({ id: site.id, patch: { publish: !site.publish } });
    } catch (err) {
      setActionError(err);
    }
  };

  const runDelete = async () => {
    if (!confirmDelete) return;
    setActionError(null);
    try {
      await removeSite(confirmDelete.id);
      setConfirmDelete(null);
    } catch (err) {
      setActionError(err);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        <SettingsPageHeader
          title="Sites"
          subtitle="Monitoring zones shown on the map when published."
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
          <>
            <div className="flex justify-end">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setFormError(null);
                  setModal({ mode: 'create' });
                }}
              >
                <Plus size={18} />
                Add site
              </button>
            </div>

            {error ? <p className="text-sm text-red-600">{errMsg(error)}</p> : null}
            {actionError && !confirmDelete ? (
              <p className="text-sm text-red-600">{errMsg(actionError)}</p>
            ) : null}

            {isLoading ? (
              <div className="flex justify-center py-16">
                <Spinner size={28} className="text-brand-600" />
              </div>
            ) : sites.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <EmptyState
                  icon={Globe}
                  message="No monitoring sites yet. Create one to define a map zone."
                  actionLabel="Add site"
                  onAction={() => setModal({ mode: 'create' })}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sites.map((site) => (
                  <article
                    key={site.id}
                    className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 hover:shadow-md hover:-translate-y-0.5 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-slate-900">{site.name}</h3>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                          site.publish
                            ? 'bg-brand-50 text-brand-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {site.publish ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600 flex items-center gap-1.5">
                      <MapPin size={14} className="text-slate-400 shrink-0" />
                      {site.latlng || 'No center set'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Zoom {site.zoom ?? '—'}</p>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="btn-secondary text-xs py-1.5 px-2"
                        onClick={() => togglePublish(site)}
                        disabled={isUpdating}
                      >
                        {site.publish ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost p-2"
                        title="Edit"
                        onClick={() => {
                          setFormError(null);
                          setModal({ mode: 'edit', site });
                        }}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="btn-ghost p-2 text-red-600 hover:bg-red-50"
                        title="Delete"
                        onClick={() => {
                          setActionError(null);
                          setConfirmDelete(site);
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {modal ? (
              <SiteFormModal
                key={modal.mode === 'create' ? 'create' : String(modal.site.id)}
                mode={modal.mode}
                site={modal.site}
                onClose={() => setModal(null)}
                onSubmitCreate={async (payload) => {
                  setFormError(null);
                  try {
                    await createSite(payload);
                  } catch (err) {
                    setFormError(err);
                    throw err;
                  }
                }}
                onSubmitUpdate={async (id, patch) => {
                  setFormError(null);
                  try {
                    await updateSite({ id, patch });
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
                title="Delete site?"
                message={`"${confirmDelete.name}" will be removed permanently.`}
                confirmLabel="Delete"
                danger
                busy={isRemoving}
                onCancel={() => setConfirmDelete(null)}
                onConfirm={runDelete}
              />
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
