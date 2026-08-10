// jobs/cache-cleanup.js
// Buang entry basi dalam throttle maps (tracking-pipeline).
// Berjalan berkala — elak memory bengkak untuk device yang dah lama senyap.

import { cleanupThrottleMaps } from '../realtime/tracking-pipeline.js';

let intervalRef = null;

/**
 * Mula cleanup berkala.
 * @param {number} intervalMs - berapa kerap jalankan cleanup
 * @param {number} maxAgeMs   - entry lebih lama dari ni dibuang
 */
export function startCacheCleanup(intervalMs = 5 * 60 * 1000, maxAgeMs = 10 * 60 * 1000) {
  if (intervalRef) return;
  console.log(`[cache-cleanup] ✓ Dimulakan (setiap ${intervalMs / 60000}min)`);
  intervalRef = setInterval(() => {
    try {
      cleanupThrottleMaps(maxAgeMs);
    } catch (err) {
      console.error('[cache-cleanup] Error:', err.message);
    }
  }, intervalMs);
}

export function stopCacheCleanup() {
  if (intervalRef) {
    clearInterval(intervalRef);
    intervalRef = null;
  }
}
