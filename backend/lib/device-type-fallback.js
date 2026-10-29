// lib/device-type-fallback.js
// Kod type dalam payload (cth "NR") mungkin tiada dalam master device_type →
// normalize beri device_type_id null. Guna type_id device berdaftar (cache)
// supaya live_tracking tidak ditimpa null dan timeout presence betul.

/**
 * @param {number|null} resolvedTypeId  hasil normalize (dari kod payload)
 * @param {{type_id?: number|null}|null} deviceMeta  rekod device dari cache
 * @returns {number|null}
 */
export function resolveDeviceTypeId(resolvedTypeId, deviceMeta) {
  if (resolvedTypeId != null) return resolvedTypeId;
  return deviceMeta?.type_id ?? null;
}
