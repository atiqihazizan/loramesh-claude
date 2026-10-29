// lib/present-fields.js
// Ambil hanya medan yang ADA nilai (bukan null/undefined) — untuk kemas kini DB
// supaya mesej yang tiada medan itu tidak menimpa nilai terakhir dengan null.

export function pickPresent(obj, keys) {
  const out = {};
  for (const k of keys) {
    if (obj?.[k] != null) out[k] = obj[k];
  }
  return out;
}

/** Medan telemetri yang kekal pada nilai terakhir bila mesej tidak membawanya. */
export const KEEP_LAST_KEYS = ['speed', 'cpu_temp', 'sensor_data'];
