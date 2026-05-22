// E3-b — agency settings form (map, tracking, session)

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { api, errMsg } from '../../lib/api.js';
import { parseLatLng } from '../../lib/mapConfig.js';
import Spinner from '../ui/Spinner.jsx';
import SettingsSection from './SettingsSection.jsx';

const TRACKING_FIELDS = [
  'tracking_zoom_moving',
  'tracking_zoom_stopped',
  'tracking_stop_radius_m',
];
const MAP_FIELDS = ['default_map_center', 'default_map_zoom', 'default_tile_provider'];
const SESSION_FIELDS = ['session_timeout_hours'];

const TILE_FALLBACK = [
  { value: 'osm', label: 'OpenStreetMap (osm)' },
  { value: 'satellite', label: 'Satellite' },
  { value: 'terrain', label: 'Terrain' },
];

function agencyToForm(agency) {
  if (!agency) return null;
  return {
    default_map_center: agency.default_map_center ?? '',
    default_map_zoom: agency.default_map_zoom ?? 13,
    default_tile_provider: agency.default_tile_provider ?? '',
    tracking_zoom_moving: agency.tracking_zoom_moving ?? 16,
    tracking_zoom_stopped: agency.tracking_zoom_stopped ?? 14,
    tracking_stop_radius_m: agency.tracking_stop_radius_m ?? 50,
    session_timeout_hours: agency.session_timeout_hours ?? 24,
  };
}

function buildPatch(original, current) {
  const patch = {};
  for (const key of [
    ...MAP_FIELDS,
    ...TRACKING_FIELDS,
    ...SESSION_FIELDS,
  ]) {
    if (original[key] !== current[key]) {
      patch[key] = current[key];
    }
  }
  return patch;
}

async function fetchTiles() {
  const res = await api.get('/tiles');
  return res.data?.tiles || [];
}

function AgencySettingsFormBody({
  agency,
  updateAgency,
  isSaving,
  saveError,
}) {
  const initial = agencyToForm(agency);
  const [form, setForm] = useState(initial);
  const [baseline, setBaseline] = useState(initial);
  const [fieldError, setFieldError] = useState(null);
  const [saved, setSaved] = useState(false);

  const tilesQuery = useQuery({
    queryKey: ['tiles'],
    queryFn: fetchTiles,
    staleTime: 5 * 60 * 1000,
  });

  const dirty = useMemo(() => {
    if (!form || !baseline) return false;
    return JSON.stringify(form) !== JSON.stringify(baseline);
  }, [form, baseline]);

  const setField = (key, value) => {
    setSaved(false);
    setFieldError(null);
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const validateClient = () => {
    if (!form) return 'Form data missing';
    if (!parseLatLng(form.default_map_center)) {
      return 'Map center must be valid "lat,lng" (e.g. 3.1390,101.6869)';
    }
    const zoom = Number(form.default_map_zoom);
    if (!Number.isInteger(zoom) || zoom < 1 || zoom > 22) {
      return 'Default zoom must be between 1 and 22';
    }
    for (const key of TRACKING_FIELDS) {
      const n = Number(form[key]);
      if (key.includes('radius')) {
        if (!Number.isInteger(n) || n < 1 || n > 1000) {
          return 'Stop radius must be between 1 and 1000 m';
        }
      } else if (!Number.isInteger(n) || n < 1 || n > 22) {
        return 'Tracking zoom must be between 1 and 22';
      }
    }
    const hrs = Number(form.session_timeout_hours);
    if (!Number.isInteger(hrs) || hrs < 1 || hrs > 8760) {
      return 'Session timeout must be between 1 and 8760 hours';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form || !baseline || !dirty) return;
    const clientErr = validateClient();
    if (clientErr) {
      setFieldError(clientErr);
      return;
    }
    const patch = buildPatch(baseline, {
      ...form,
      default_map_zoom: Number(form.default_map_zoom),
      tracking_zoom_moving: Number(form.tracking_zoom_moving),
      tracking_zoom_stopped: Number(form.tracking_zoom_stopped),
      tracking_stop_radius_m: Number(form.tracking_stop_radius_m),
      session_timeout_hours: Number(form.session_timeout_hours),
    });
    if (Object.keys(patch).length === 0) return;

    try {
      await updateAgency(patch);
      setBaseline({ ...form });
      setSaved(true);
      setFieldError(null);
    } catch {
      // saveError from hook
    }
  };

  const tiles = tilesQuery.data ?? [];
  const tileOptions =
    tiles.length > 0
      ? tiles.map((t) => ({
          value: t.name,
          label: t.name,
        }))
      : TILE_FALLBACK;

  const formErr = fieldError || (saveError ? errMsg(saveError) : null);

  return (
    <SettingsSection
      title="Agency configuration"
      description={
        agency?.name
          ? `${agency.name} (${agency.code})`
          : 'Map defaults, follow camera, and session'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-8">
        {formErr ? (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {formErr}
          </p>
        ) : null}
        {saved ? (
          <p className="text-sm text-brand-700 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2">
            Saved
          </p>
        ) : null}

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-slate-700">Map</legend>
          <div>
            <label className="label" htmlFor="default_map_center">
              Default center (lat,lng)
            </label>
            <input
              id="default_map_center"
              className="input"
              value={form.default_map_center}
              onChange={(e) => setField('default_map_center', e.target.value)}
              placeholder="3.1390,101.6869"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="default_map_zoom">
                Default zoom (1–22)
              </label>
              <input
                id="default_map_zoom"
                type="number"
                min={1}
                max={22}
                className="input"
                value={form.default_map_zoom}
                onChange={(e) =>
                  setField('default_map_zoom', e.target.valueAsNumber || e.target.value)
                }
              />
            </div>
            <div>
              <label className="label" htmlFor="default_tile_provider">
                Tile provider
              </label>
              <select
                id="default_tile_provider"
                className="input"
                value={form.default_tile_provider}
                onChange={(e) => setField('default_tile_provider', e.target.value)}
              >
                <option value="">— Select —</option>
                {tileOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-slate-700">
            Tracking (follow camera)
          </legend>
          <p className="text-xs text-slate-500 -mt-2">
            These values affect zoom and stop behavior when following devices on the map.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label" htmlFor="tracking_zoom_moving">
                Moving zoom (1–22)
              </label>
              <input
                id="tracking_zoom_moving"
                type="number"
                min={1}
                max={22}
                className="input"
                value={form.tracking_zoom_moving}
                onChange={(e) =>
                  setField('tracking_zoom_moving', e.target.valueAsNumber || e.target.value)
                }
              />
            </div>
            <div>
              <label className="label" htmlFor="tracking_zoom_stopped">
                Stopped zoom (1–22)
              </label>
              <input
                id="tracking_zoom_stopped"
                type="number"
                min={1}
                max={22}
                className="input"
                value={form.tracking_zoom_stopped}
                onChange={(e) =>
                  setField('tracking_zoom_stopped', e.target.valueAsNumber || e.target.value)
                }
              />
            </div>
            <div>
              <label className="label" htmlFor="tracking_stop_radius_m">
                Stop radius (m, 1–1000)
              </label>
              <input
                id="tracking_stop_radius_m"
                type="number"
                min={1}
                max={1000}
                className="input"
                value={form.tracking_stop_radius_m}
                onChange={(e) =>
                  setField('tracking_stop_radius_m', e.target.valueAsNumber || e.target.value)
                }
              />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold text-slate-700 mb-4">Session</legend>
          <div className="max-w-xs">
            <label className="label" htmlFor="session_timeout_hours">
              Session timeout (hours, 1–8760)
            </label>
            <input
              id="session_timeout_hours"
              type="number"
              min={1}
              max={8760}
              className="input"
              value={form.session_timeout_hours}
              onChange={(e) =>
                setField('session_timeout_hours', e.target.valueAsNumber || e.target.value)
              }
            />
          </div>
        </fieldset>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            type="submit"
            className="btn-primary"
            disabled={!dirty || isSaving}
          >
            {isSaving ? (
              <Spinner size={18} className="text-white" />
            ) : (
              <Save size={18} />
            )}
            Save
          </button>
        </div>
      </form>
    </SettingsSection>
  );
}

export default function AgencySettingsForm({
  agency,
  isLoading,
  updateAgency,
  isSaving,
  saveError,
}) {
  if (isLoading || !agency) {
    return (
      <SettingsSection title="Agency configuration" description="Loading…">
        <div className="flex justify-center py-8">
          <Spinner size={28} className="text-brand-600" />
        </div>
      </SettingsSection>
    );
  }

  const formKey = `${agency.id}-${agency.updated_at ?? ''}`;

  return (
    <AgencySettingsFormBody
      key={formKey}
      agency={agency}
      updateAgency={updateAgency}
      isSaving={isSaving}
      saveError={saveError}
    />
  );
}
