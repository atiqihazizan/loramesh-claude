// Editor peta register sensor per-device (devices.sensor_unit).
// Baris = urutan register; indeks dikira automatik (int16 = 1 register, float32 = 2).
// Unit & julat datang daripada master_sensor — tidak ditaip di sini.

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import { errMsg } from '../../lib/api.js';
import { useMasterSensors } from '../../hooks/useMasterSensors.js';
import { decodeSensors, effectiveLength } from '../../lib/sensorDecode.js';
import Spinner from '../ui/Spinner.jsx';

const MODES = [
  { value: 'int16:1', label: 'int16 · raw', type: 'int16', scale: 1 },
  { value: 'int16:0.1', label: 'int16 · ÷10', type: 'int16', scale: 0.1 },
  { value: 'int16:0.01', label: 'int16 · ÷100', type: 'int16', scale: 0.01 },
  { value: 'int16:0.001', label: 'int16 · ÷1000', type: 'int16', scale: 0.001 },
  { value: 'float32:swap', label: 'float32 · IEEE754 (swap)', type: 'float32', wordSwap: true },
  { value: 'float32:plain', label: 'float32 · IEEE754', type: 'float32', wordSwap: false },
  { value: 'skip', label: 'Unused (skip)', type: 'skip' },
];
const MODE_BY_VALUE = Object.fromEntries(MODES.map((m) => [m.value, m]));

let ridSeq = 0;
const nextRid = () => `r${++ridSeq}`;

function modeOf(entry) {
  if (entry.type === 'skip') return 'skip';
  if (entry.type === 'float32') return entry.wordSwap ? 'float32:swap' : 'float32:plain';
  const hit = MODES.find((m) => m.type === 'int16' && m.scale === (entry.scale ?? 1));
  return hit ? hit.value : 'int16:1';
}

function fromMap(map) {
  if (!Array.isArray(map)) return [];
  return [...map]
    .sort((a, b) => a.idx - b.idx)
    .map((e) => ({
      rid: nextRid(),
      sensor_id: e.sensor_id != null ? String(e.sensor_id) : '',
      label: e.label ?? '',
      mode: modeOf(e),
      dp: e.dp ?? 2,
    }));
}

const spanOf = (mode) => (MODE_BY_VALUE[mode].type === 'float32' ? 2 : 1);

const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);

/** Baris → peta (idx dikira; key unik daripada label). */
function toMap(rows) {
  const used = new Set();
  let idx = 0;
  return rows.map((r) => {
    const m = MODE_BY_VALUE[r.mode];
    const at = idx;
    idx += spanOf(r.mode);
    if (m.type === 'skip') return { key: `skip_${at}`, type: 'skip', idx: at };

    const base = slug(r.label) || `reg_${at}`;
    let key = base;
    for (let n = 2; used.has(key); n++) key = `${base}_${n}`;
    used.add(key);

    const entry = {
      key,
      label: r.label.trim(),
      sensor_id: r.sensor_id ? parseInt(r.sensor_id, 10) : null,
      idx: at,
      type: m.type,
      dp: Number.isInteger(r.dp) ? r.dp : 2,
    };
    if (m.type === 'int16') entry.scale = m.scale;
    else entry.wordSwap = m.wordSwap;
    return entry;
  });
}

export default function SensorMapModal({ device, onClose, onSave, isSaving, submitError }) {
  const { sensors, isLoading: sensorsLoading } = useMasterSensors();
  const [rows, setRows] = useState(() => fromMap(device.sensor_unit));
  const [localError, setLocalError] = useState(null);

  const sensorById = useMemo(() => new Map(sensors.map((s) => [String(s.id), s])), [sensors]);
  const raw = Array.isArray(device.sensor_data) ? device.sensor_data : null;

  const map = useMemo(() => toMap(rows), [rows]);
  const totalRegisters = rows.reduce((n, r) => n + spanOf(r.mode), 0);

  const preview = useMemo(() => {
    const out = {};
    if (!raw || rows.length === 0) return out;
    const withUnit = map.map((e) => ({ ...e, unit: sensorById.get(String(e.sensor_id))?.unit ?? '' }));
    for (const d of decodeSensors(raw, withUnit, { ignoreLength: true }) ?? []) out[d.key] = d;
    return out;
  }, [raw, rows.length, map, sensorById]);

  const patchRow = (rid, patch) => {
    setLocalError(null);
    setRows((prev) => prev.map((r) => (r.rid === rid ? { ...r, ...patch } : r)));
  };

  const pickSensor = (row, value) => {
    const prevName = sensorById.get(row.sensor_id)?.name;
    const next = sensorById.get(value);
    // Label ikut nama master selagi pengguna belum menukarnya.
    const label = !row.label || row.label === prevName ? next?.name ?? row.label : row.label;
    patchRow(row.rid, { sensor_id: value, label });
  };

  const addRow = () => {
    setLocalError(null);
    setRows((prev) => [...prev, { rid: nextRid(), sensor_id: '', label: '', mode: 'int16:0.1', dp: 2 }]);
  };
  const removeRow = (rid) => {
    setLocalError(null);
    setRows((prev) => prev.filter((r) => r.rid !== rid));
  };
  const moveRow = (i, d) => {
    setLocalError(null);
    setRows((prev) => {
      const j = i + d;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const handleSave = async () => {
    const incomplete = rows.some((r) => r.mode !== 'skip' && (!r.sensor_id || !r.label.trim()));
    if (incomplete) {
      setLocalError('Every row needs a master sensor and a label (or set it to Unused).');
      return;
    }
    try {
      await onSave(rows.length === 0 ? null : map);
      onClose();
    } catch (err) {
      setLocalError(errMsg(err));
    }
  };

  const dataLen = raw ? effectiveLength(raw) : null;
  const matches = raw && rows.length > 0 && dataLen === totalRegisters;
  const displayError = localError || (submitError ? errMsg(submitError) : null);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div className="rounded-xl border border-slate-200 bg-white w-full max-w-4xl p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Sensor map</h3>
            <p className="text-xs text-slate-500">
              {device.name} · {device.device_id}
              {device.type?.name ? ` · ${device.type.name}` : ''}
            </p>
          </div>
          <button type="button" className="btn-ghost p-2" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {displayError ? (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{displayError}</p>
        ) : null}

        <div
          className={`text-sm rounded-lg px-3 py-2 mb-2 ${
            matches
              ? 'bg-green-50 text-green-700'
              : raw && rows.length > 0
                ? 'bg-amber-50 text-amber-700'
                : 'bg-slate-50 text-slate-600'
          }`}
        >
          {!raw
            ? `Map covers ${totalRegisters} registers · no latest data to compare.`
            : rows.length === 0
              ? `No map yet · latest data has ${dataLen} registers.`
              : matches
                ? `Map covers ${totalRegisters} registers · latest data has ${dataLen} · match`
                : `Map covers ${totalRegisters} registers · latest data has ${dataLen} · NO MATCH — the map will not be applied until they match.`}
        </div>
        {raw ? (
          <p className="text-xs text-slate-500 mb-3 break-all">
            Latest raw: <span className="font-mono">{JSON.stringify(raw)}</span>
          </p>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="py-1 pr-2 font-medium">Reg</th>
                <th className="py-1 pr-2 font-medium">Master sensor</th>
                <th className="py-1 pr-2 font-medium">Label</th>
                <th className="py-1 pr-2 font-medium">Type / formula</th>
                <th className="py-1 pr-2 font-medium">Dp</th>
                <th className="py-1 pr-2 font-medium">Preview</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {map.map((entry, i) => {
                const row = rows[i];
                const skip = row.mode === 'skip';
                const master = sensorById.get(row.sensor_id);
                const p = preview[entry.key];
                const regs = spanOf(row.mode) === 2 ? `${entry.idx}–${entry.idx + 1}` : String(entry.idx);
                return (
                  <tr key={row.rid} className="border-t border-slate-100 align-middle">
                    <td className="py-1.5 pr-2 font-mono text-xs text-slate-500">{regs}</td>
                    <td className="py-1.5 pr-2">
                      {skip ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <select
                          className="input py-1 text-sm"
                          value={row.sensor_id}
                          disabled={sensorsLoading}
                          onChange={(e) => pickSensor(row, e.target.value)}
                        >
                          <option value="">Select…</option>
                          {sensors.map((s) => (
                            <option key={s.id} value={String(s.id)}>
                              {s.name}
                              {s.unit ? ` (${s.unit})` : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="py-1.5 pr-2">
                      {skip ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <input
                          className="input py-1 text-sm"
                          value={row.label}
                          maxLength={100}
                          onChange={(e) => patchRow(row.rid, { label: e.target.value })}
                        />
                      )}
                    </td>
                    <td className="py-1.5 pr-2">
                      <select
                        className="input py-1 text-sm"
                        value={row.mode}
                        onChange={(e) => patchRow(row.rid, { mode: e.target.value })}
                      >
                        {MODES.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 pr-2 w-16">
                      {skip ? null : (
                        <input
                          className="input py-1 text-sm"
                          type="number"
                          min={0}
                          max={6}
                          value={row.dp}
                          onChange={(e) =>
                            patchRow(row.rid, {
                              dp: e.target.value === '' ? '' : parseInt(e.target.value, 10),
                            })
                          }
                        />
                      )}
                    </td>
                    <td className="py-1.5 pr-2 whitespace-nowrap">
                      {skip || !p ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <>
                          <span className="font-medium text-slate-800">{p.text}</span>
                          {master?.unit && p.value !== null ? (
                            <span className="ml-1 text-xs rounded bg-slate-100 text-slate-600 px-1.5 py-0.5">
                              {master.unit}
                            </span>
                          ) : null}
                        </>
                      )}
                    </td>
                    <td className="py-1.5 whitespace-nowrap text-right">
                      <button
                        type="button"
                        title="Move up"
                        className="btn-ghost p-1"
                        disabled={i === 0}
                        onClick={() => moveRow(i, -1)}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        title="Move down"
                        className="btn-ghost p-1"
                        disabled={i === rows.length - 1}
                        onClick={() => moveRow(i, 1)}
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        title="Remove row"
                        className="btn-ghost p-1 text-red-600 hover:bg-red-50"
                        onClick={() => removeRow(row.rid)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-slate-400">
                    No rows. Add a row for each register block, in order.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-3">
          <button type="button" className="btn-secondary" onClick={addRow}>
            <Plus size={16} />
            Add row
          </button>
        </div>

        <p className="text-xs text-slate-500 mt-3">
          Rows follow register order; the register index is worked out for you (float32 uses two
          registers). Unit and range come from the master sensor. Saving an empty map falls back to
          raw data.
        </p>

        <div className="flex justify-end gap-2 pt-4">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" disabled={isSaving} onClick={handleSave}>
            {isSaving ? <Spinner size={18} className="text-white" /> : 'Save map'}
          </button>
        </div>
      </div>
    </div>
  );
}
