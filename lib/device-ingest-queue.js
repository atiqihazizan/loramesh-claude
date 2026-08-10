// lib/device-ingest-queue.js
// Queue serial per device_id — elak race condition dedup in-memory.

/** @type {Map<string, Promise<unknown>>} */
const chains = new Map();

/**
 * Jalankan tugas ingest secara berurutan untuk satu device.
 * Mesej MQTT device sama tidak diproses selari.
 *
 * @param {string|null|undefined} deviceId
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export function enqueueDeviceIngest(deviceId, fn) {
  const key = deviceId ? String(deviceId) : '__global__';
  const prev = chains.get(key) ?? Promise.resolve();

  const next = prev
    .catch(() => {})
    .then(fn);

  chains.set(
    key,
    next.finally(() => {
      if (chains.get(key) === next) chains.delete(key);
    })
  );

  return next;
}

export function getActiveIngestQueues() {
  return chains.size;
}
