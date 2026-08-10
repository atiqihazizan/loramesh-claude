// Tiles — map tile providers page (SUPERADMIN only)

import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { errMsg } from '../../lib/api.js';
import { useAuthStore } from '../../store/authStore.js';
import { useTilesCrud } from '../../hooks/useTilesCrud.js';
import SettingsPageHeader from '../../components/settings/SettingsPageHeader.jsx';
import SettingsSection from '../../components/settings/SettingsSection.jsx';
import DataTable from '../../components/settings/DataTable.jsx';
import ConfirmDialog from '../../components/settings/ConfirmDialog.jsx';
import TileFormModal from '../../components/settings/TileFormModal.jsx';

function UrlCell({ url }) {
  if (!url) return '—';
  const short = url.length > 60 ? `${url.slice(0, 60)}...` : url;
  return (
    <span className="block max-w-[420px] truncate" title={url}>
      {short}
    </span>
  );
}

export default function TilesPage() {
  const isSuperadmin = useAuthStore((s) => s.isSuperadmin());
  const {
    tiles,
    isLoading,
    error,
    createTile,
    updateTile,
    removeTile,
    isCreating,
    isUpdating,
    isRemoving,
  } = useTilesCrud();

  const [modal, setModal] = useState(null);
  const [formError, setFormError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [actionError, setActionError] = useState(null);

  if (!isSuperadmin) {
    return <Navigate to="/settings/account" replace />;
  }

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'icon', label: 'Icon' },
    {
      key: 'url',
      label: 'URL',
      render: (row) => <UrlCell url={row.url} />,
    },
    { key: 'theme', label: 'Theme' },
  ];

  const handleSubmit = async (payload) => {
    setFormError(null);
    try {
      if (modal?.tile) {
        await updateTile({ id: modal.tile.id, patch: payload });
      } else {
        await createTile(payload);
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
      await removeTile(confirmDelete.id);
      setConfirmDelete(null);
    } catch (err) {
      setActionError(err);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        <SettingsPageHeader
          title="Tiles"
          subtitle="Map tile providers available in agency settings."
        />

        <SettingsSection
          title="Tile providers"
          description="Create, edit, or remove map tile providers. A tile still referenced by an agency cannot be deleted."
        >
          <div className="flex justify-end mb-3">
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setModal({ tile: null });
              }}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2
                         text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus size={16} />
              New tile
            </button>
          </div>

          {isLoading ? (
            <p className="text-sm text-slate-400">Loading...</p>
          ) : error ? (
            <p className="text-sm text-red-600">
              {errMsg(error, 'Failed to load tiles')}
            </p>
          ) : (
            <DataTable
              columns={columns}
              rows={tiles}
              renderActions={(row) => (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setFormError(null);
                      setModal({ tile: row });
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
        <TileFormModal
          tile={modal.tile}
          onSubmit={handleSubmit}
          onClose={() => setModal(null)}
          isSaving={isCreating || isUpdating}
          error={formError}
        />
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          title="Delete tile"
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