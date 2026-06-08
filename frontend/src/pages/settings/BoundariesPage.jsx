// Boundary management — draw, edit single, upload, delete (agency admin)

import { useMemo, useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  X,
  Undo2,
  Save,
} from 'lucide-react';
import { errMsg } from '../../lib/api.js';
import { useAuthStore } from '../../store/authStore.js';
import { useAgencies } from '../../hooks/useAgencies.js';
import { useAgencyBoundaries } from '../../hooks/useAgencyBoundaries.js';
import SettingsPageHeader from '../../components/settings/SettingsPageHeader.jsx';
import SuperadminAgencyPicker from '../../components/settings/SuperadminAgencyPicker.jsx';
import ConfirmDialog from '../../components/settings/ConfirmDialog.jsx';
import EmptyState from '../../components/settings/EmptyState.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import BoundaryMapEditor from '../../components/settings/boundaries/BoundaryMapEditor.jsx';
import {
  polygonVerticesFromFeature,
  verticesToPolygon,
} from '../../components/settings/boundaries/boundaryGeoUtils.js';
import BoundaryUploadPanel from '../../components/settings/boundaries/BoundaryUploadPanel.jsx';

export default function BoundariesPage() {
  const isAgencyAdmin = useAuthStore((s) => s.isAgencyAdmin());
  const isSuperadmin = useAuthStore((s) => s.isSuperadmin());
  const { agencies, isLoading: agenciesLoading } = useAgencies();
  const [superadminAgencyId, setSuperadminAgencyId] = useState(null);

  const agencyTargetId = isSuperadmin
    ? superadminAgencyId ?? agencies[0]?.id ?? null
    : undefined;

  const {
    features,
    isLoading,
    error,
    createBoundary,
    updateBoundary,
    removeBoundary,
    uploadBoundaries,
    isCreating,
    isUpdating,
    isRemoving,
    isUploading,
  } = useAgencyBoundaries(agencyTargetId);

  const adminReady = !isSuperadmin || agencyTargetId != null;

  const [mode, setMode] = useState('view'); // view | create | edit
  const [editFeature, setEditFeature] = useState(null);
  const [editName, setEditName] = useState('');
  const [editVisible, setEditVisible] = useState(true);
  const [editVertices, setEditVertices] = useState([]);
  const [createName, setCreateName] = useState('');
  const [createVisible, setCreateVisible] = useState(true);
  const [draftPoints, setDraftPoints] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [flyToTarget, setFlyToTarget] = useState(null);
  const [flyNonce, setFlyNonce] = useState(0);

  if (!isAgencyAdmin) {
    return <Navigate to="/settings/account" replace />;
  }

  const resetEditor = useCallback(() => {
    setMode('view');
    setEditFeature(null);
    setEditVertices([]);
    setDraftPoints([]);
    setCreateName('');
    setCreateVisible(true);
    setActionError(null);
  }, []);

  const displayFeatures = useMemo(() => {
    if (mode === 'edit' && editFeature) return [editFeature];
    if (mode === 'create') return [];
    return features.filter((f) => f.properties?.visible !== false);
  }, [mode, editFeature, features]);

  const modeKey = mode === 'edit' ? `edit-${editFeature?.properties?.id}` : mode;

  const startCreate = () => {
    resetEditor();
    setMode('create');
  };

  const startEdit = (feature) => {
    setActionError(null);
    setMode('edit');
    setEditFeature(feature);
    setEditName(feature.properties?.name ?? '');
    setEditVisible(feature.properties?.visible !== false);
    const verts = polygonVerticesFromFeature(feature);
    setEditVertices(verts ?? []);
  };

  const flyToFeature = (feature) => {
    setFlyNonce((n) => {
      const next = n + 1;
      setFlyToTarget({ feature, nonce: next });
      return next;
    });
  };

  const handleMapClick = ({ lng, lat }) => {
    setDraftPoints((pts) => [...pts, [lng, lat]]);
  };

  const handleVertexDrag = (index, { lng, lat }) => {
    setEditVertices((verts) => {
      const next = verts.map((v, i) => (i === index ? [lng, lat] : v));
      const geom = verticesToPolygon(next);
      if (geom && editFeature) {
        setEditFeature((prev) => (prev ? { ...prev, geometry: geom } : prev));
      }
      return next;
    });
  };

  const canSaveCreate = draftPoints.length >= 3 && createName.trim().length > 0;
  const isPolygonEditable =
    mode === 'edit' && editFeature?.geometry?.type === 'Polygon';

  const saveCreate = async () => {
    const geometry = verticesToPolygon(draftPoints);
    if (!geometry) {
      setActionError(new Error('Lukis sekurang-kurangnya 3 titik'));
      return;
    }
    setActionError(null);
    try {
      await createBoundary({
        name: createName.trim(),
        visible: createVisible,
        coordinates: geometry,
      });
      resetEditor();
    } catch (err) {
      setActionError(err);
    }
  };

  const saveEdit = async () => {
    if (!editFeature) return;
    setActionError(null);
    const patch = {
      name: editName.trim(),
      visible: editVisible,
    };
    if (isPolygonEditable) {
      const geometry = verticesToPolygon(editVertices);
      if (geometry) patch.coordinates = geometry;
    }
    try {
      await updateBoundary({ id: editFeature.properties.id, patch });
      resetEditor();
    } catch (err) {
      setActionError(err);
    }
  };

  const toggleVisible = async (feature) => {
    setActionError(null);
    try {
      await updateBoundary({
        id: feature.properties.id,
        patch: { visible: feature.properties.visible === false },
      });
    } catch (err) {
      setActionError(err);
    }
  };

  const runDelete = async () => {
    if (!confirmDelete) return;
    setActionError(null);
    try {
      await removeBoundary(confirmDelete.properties.id);
      if (editFeature?.properties?.id === confirmDelete.properties.id) {
        resetEditor();
      }
      setConfirmDelete(null);
    } catch (err) {
      setActionError(err);
    }
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <SettingsPageHeader
          title="Boundaries"
          subtitle="Kawasan geofence per agency — lukis, edit, atau upload GeoJSON."
        />
        {isSuperadmin ? (
          <div className="mt-4 max-w-md">
            <SuperadminAgencyPicker
              agencyId={superadminAgencyId}
              onChange={setSuperadminAgencyId}
              agencies={agencies}
              isLoading={agenciesLoading}
            />
          </div>
        ) : null}
      </div>

      {!adminReady ? (
        <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
          Pilih agency untuk mula.
        </div>
      ) : (
        <div className="flex-1 flex min-h-0">
          <aside className="w-full max-w-sm shrink-0 border-r border-slate-200 bg-white flex flex-col min-h-0">
            <div className="p-3 border-b border-slate-100 space-y-2">
              {mode === 'view' ? (
                <button type="button" className="btn-primary w-full text-sm" onClick={startCreate}>
                  <Plus size={16} />
                  Tambah boundary
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-secondary flex-1 text-sm"
                    onClick={resetEditor}
                  >
                    <X size={16} />
                    Batal
                  </button>
                  <button
                    type="button"
                    className="btn-primary flex-1 text-sm"
                    disabled={
                      mode === 'create'
                        ? !canSaveCreate || isCreating
                        : !editName.trim() || isUpdating
                    }
                    onClick={mode === 'create' ? saveCreate : saveEdit}
                  >
                    {isCreating || isUpdating ? (
                      <Spinner size={16} className="text-white" />
                    ) : (
                      <Save size={16} />
                    )}
                    Simpan
                  </button>
                </div>
              )}

              {mode === 'create' ? (
                <div className="space-y-2 pt-1">
                  <div>
                    <label className="label" htmlFor="create-name">
                      Nama
                    </label>
                    <input
                      id="create-name"
                      className="input text-sm"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      placeholder="cth. Zon Utara"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={createVisible}
                      onChange={(e) => setCreateVisible(e.target.checked)}
                    />
                    Visible di peta
                  </label>
                  <p className="text-xs text-slate-500">
                    Klik peta untuk tambah titik ({draftPoints.length} titik). Minimum 3 titik.
                  </p>
                  <button
                    type="button"
                    className="btn-ghost text-xs w-full"
                    disabled={draftPoints.length === 0}
                    onClick={() => setDraftPoints((p) => p.slice(0, -1))}
                  >
                    <Undo2 size={14} />
                    Buang titik terakhir
                  </button>
                </div>
              ) : null}

              {mode === 'edit' ? (
                <div className="space-y-2 pt-1">
                  <div>
                    <label className="label" htmlFor="edit-name">
                      Nama
                    </label>
                    <input
                      id="edit-name"
                      className="input text-sm"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={editVisible}
                      onChange={(e) => setEditVisible(e.target.checked)}
                    />
                    Visible di peta
                  </label>
                  {editFeature?.geometry?.type === 'MultiPolygon' ? (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded p-2">
                      MultiPolygon — hanya nama/visible boleh diubah. Upload semula untuk tukar
                      bentuk.
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Seret titik kuning untuk ubah bentuk. Boundary lain disembunyikan.
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            {mode === 'view' ? (
              <div className="p-3 border-b border-slate-100">
                <BoundaryUploadPanel
                  onUpload={uploadBoundaries}
                  isUploading={isUploading}
                  disabled={!adminReady}
                />
              </div>
            ) : null}

            <div className="flex-1 overflow-y-auto p-2">
              {error ? (
                <p className="text-sm text-red-600 px-2 py-2">{errMsg(error)}</p>
              ) : null}
              {actionError && !confirmDelete ? (
                <p className="text-sm text-red-600 px-2 py-2">{errMsg(actionError)}</p>
              ) : null}

              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Spinner size={24} className="text-brand-600" />
                </div>
              ) : mode !== 'view' ? null : features.length === 0 ? (
                <EmptyState
                  icon={MapPin}
                  message="Tiada boundary. Lukis baru atau upload GeoJSON."
                  actionLabel="Tambah boundary"
                  onAction={startCreate}
                />
              ) : (
                <ul className="space-y-1">
                  {features.map((f) => {
                    const p = f.properties;
                    const hidden = p.visible === false;
                    return (
                      <li
                        key={p.id}
                        className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50"
                      >
                        <button
                          type="button"
                          className={`text-left text-sm font-medium w-full ${
                            hidden ? 'text-slate-400' : 'text-slate-900'
                          }`}
                          onClick={() => flyToFeature(f)}
                          title="Pergi ke boundary (zoom 18)"
                        >
                          {p.name}
                        </button>
                        <p className="text-xs text-slate-500 mt-0.5">{p.agency_name}</p>
                        <div className="mt-2 flex items-center gap-1">
                          <button
                            type="button"
                            className="btn-ghost p-1.5"
                            title={hidden ? 'Show' : 'Hide'}
                            disabled={isUpdating}
                            onClick={() => toggleVisible(f)}
                          >
                            {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                          <button
                            type="button"
                            className="btn-ghost p-1.5"
                            title="Edit"
                            onClick={() => startEdit(f)}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn-ghost p-1.5 text-red-600 hover:bg-red-50"
                            title="Delete"
                            onClick={() => {
                              setActionError(null);
                              setConfirmDelete(f);
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          <div className="flex-1 relative min-h-[280px] min-w-0">
            <BoundaryMapEditor
              mode={mode}
              displayFeatures={displayFeatures}
              draftPoints={draftPoints}
              editVertices={isPolygonEditable ? editVertices : []}
              onMapClick={mode === 'create' ? handleMapClick : undefined}
              onVertexDrag={isPolygonEditable ? handleVertexDrag : undefined}
              flyToTarget={flyToTarget}
              modeKey={modeKey}
            />
            {mode === 'create' ? (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 rounded-full bg-slate-900/85 text-white text-xs px-4 py-2 pointer-events-none">
                Klik peta untuk lukis polygon
              </div>
            ) : null}
            {mode === 'edit' ? (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 rounded-full bg-slate-900/85 text-white text-xs px-4 py-2 pointer-events-none">
                Edit: {editName || '—'}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {confirmDelete ? (
        <ConfirmDialog
          title="Padam boundary?"
          message={`"${confirmDelete.properties?.name}" akan dipadam kekal.`}
          confirmLabel="Padam"
          danger
          busy={isRemoving}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={runDelete}
        />
      ) : null}
    </div>
  );
}
