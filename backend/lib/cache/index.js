// lib/cache/index.js
// Initialize all caches on server startup. Called once from server.js.

import { loadAgencyCache,        getCacheSize as agencyCacheSize        } from './agency-cache.js';
import { loadDeviceAgencyCache,  getCacheSize as deviceAgencyCacheSize  } from './device-agency-cache.js';
import { loadDeviceCache,        getCacheSize as deviceCacheSize        } from './device-cache.js';
import { loadDeviceStaticCache,  getCacheSize as deviceStaticCacheSize  } from './device-static-cache.js';

/**
 * Load all caches in parallel.
 * Call once from server.js after Prisma connect, before HTTP server listen.
 */
export async function initAllCaches() {
  console.log('[cache] Loading all caches...');
  const start = Date.now();
  await Promise.all([
    loadAgencyCache(),
    loadDeviceAgencyCache(),
    loadDeviceCache(),
    loadDeviceStaticCache(),
  ]);
  const elapsed = Date.now() - start;
  console.log(`[cache] ✓ All caches loaded in ${elapsed}ms`);
}

/**
 * Get current size of every cache. Useful for /api/health endpoint.
 */
export function getAllCacheStats() {
  return {
    agency: agencyCacheSize(),
    device_agency: deviceAgencyCacheSize(),
    device: deviceCacheSize(),
    device_static: deviceStaticCacheSize(),
  };
}