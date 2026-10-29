// src/lib/mergeDevicePatch.js
// Fungsi tulen: gabung patch socket ke senarai device (cache REST).
// Medan undefined DAN null diabaikan — payload sensor-sahaja tidak
// boleh memadam latitude/longitude (marker hilang) atau sensor lama.

/**
 * @param {Array|undefined} devices  senarai semasa
 * @param {object} patch             mesti ada device_id
 * @returns {Array|undefined} senarai baharu, atau rujukan asal jika tiada perubahan
 */
export function mergeDevicePatchIntoList(devices, patch) {
  if (!Array.isArray(devices) || !patch?.device_id) return devices;

  const clean = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined && v !== null) clean[k] = v;
  }

  let found = false;
  const next = devices.map((d) => {
    if (d.device_id !== clean.device_id) return d;
    found = true;
    return { ...d, ...clean };
  });

  // Device tiada dalam senarai REST → abaikan (REST ialah sumber set awal).
  return found ? next : devices;
}
