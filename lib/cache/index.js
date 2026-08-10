// lib/cache/index.js
// Initialize all caches on server startup. Called once from server.js.

import { loadAgencyCache,       getCacheSize as agencyCacheSize       } from './agency-cache.js';
import { loadDeviceAgencyCache, getCacheSize as deviceAgencyCacheSize } from './device-agency-cache.js';
import { loadDeviceCache,       getCacheSize as deviceCacheSize       } from './device-cache.js';
import { loadDeviceStaticCache, getCacheSize as deviceStaticCacheSize } from './device-static-cache.js';
import { loadDeviceTypeCache,   getCacheSize as deviceTypeCacheSize   } from './device-type-cache.js';

export async function initAllCaches() {
  console.log('[cache] Loading all caches...');
  const start = Date.now();
  await Promise.all([
    loadAgencyCache(),
    loadDeviceAgencyCache(),
    loadDeviceCache(),
    loadDeviceStaticCache(),
    loadDeviceTypeCache(),
  ]);
  const elapsed = Date.now() - start;
  console.log(`[cache] ✓ All caches loaded in ${elapsed}ms`);
}

export function getAllCacheStats() {
  return {
    agency: agencyCacheSize(),
    device_agency: deviceAgencyCacheSize(),
    device: deviceCacheSize(),
    device_static: deviceStaticCacheSize(),
    device_type: deviceTypeCacheSize(),
  };
}
