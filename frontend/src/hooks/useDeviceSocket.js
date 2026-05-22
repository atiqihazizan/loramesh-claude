// src/hooks/useDeviceSocket.js
// ----------------------------------------------------------------
// Realtime device updates via Socket.IO (E2-markers-b).
//
// Responsibilities:
//   - Connect the shared socket.
//   - For superadmin (agency: null), emit `subscribe:agency` with
//     the selected agency id so the server joins us to that room.
//     Regular users are auto-joined server-side — no emit needed.
//   - Listen for `device:update` (position + telemetry) and
//     `device:status` (live status changes).
//   - Merge each patch into the React Query cache for ['devices',
//     agencyId] so markers/popup/detail panel update live.
//
// Merge rule: socket fields overwrite REST fields. Live status
// from socket is `status_live` — written into the device's
// `status` field so the whole UI reads one field.
//
// Note: takes selectedAgencyId as an ARGUMENT (not via context) —
// this avoids a circular import with MapContext, which itself
// calls this hook.
// ----------------------------------------------------------------

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectSocket } from '../lib/socket.js';
import { useAuthStore } from '../store/authStore.js';

/**
 * Merge a partial device patch (keyed by device_id) into the
 * cached device list for the given agency.
 *
 * Only fields with a defined value overwrite the existing device —
 * an `undefined` field in the patch keeps the old value (so a
 * socket event missing a field does not wipe REST data).
 */
function mergeDevicePatch(queryClient, agencyId, patch) {
  const key = ['devices', agencyId];
  const current = queryClient.getQueryData(key);
  if (!Array.isArray(current)) return;

  // Strip undefined fields — keep only what the socket actually sent.
  const clean = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) clean[k] = v;
  }

  let found = false;
  const next = current.map((d) => {
    if (d.device_id !== clean.device_id) return d;
    found = true;
    // Defined socket fields overwrite; missing fields keep old value.
    return { ...d, ...clean };
  });

  // If the device is not in the REST list yet, ignore the patch.
  // (E2-markers-a decided: REST is the source of the initial set.)
  if (!found) return;

  queryClient.setQueryData(key, next);
}

/**
 * @param {number|null} selectedAgencyId  agency currently viewed
 */
export function useDeviceSocket(selectedAgencyId) {
  const queryClient = useQueryClient();
  const isSuperadmin = useAuthStore((s) => s.isSuperadmin());

  useEffect(() => {
    if (selectedAgencyId == null) return;

    const socket = connectSocket();

    // --- Superadmin: join the agency room explicitly -----------
    // Regular users are auto-joined server-side.
    const subscribe = () => {
      if (isSuperadmin) {
        socket.emit('subscribe:agency', { agency_id: selectedAgencyId });
      }
    };

    // Subscribe now if already connected, and again on reconnect.
    if (socket.connected) subscribe();
    socket.on('connect', subscribe);

    // --- device:update — position + telemetry ------------------
    const onUpdate = (data) => {
      if (!data?.device_id) return;
      mergeDevicePatch(queryClient, selectedAgencyId, {
        device_id: data.device_id,
        latitude: data.latitude,
        longitude: data.longitude,
        speed: data.speed,
        heading: data.heading,
        cpu_temp: data.cpu_temp,
        battery_level: data.battery_level,
        sensor_data: data.sensor_data,
        send_dt: data.send_dt,
        // status_live → status (one field for the whole UI).
        status: data.status_live,
      });
    };

    // --- device:status — live status change --------------------
    const onStatus = (data) => {
      if (!data?.device_id) return;
      mergeDevicePatch(queryClient, selectedAgencyId, {
        device_id: data.device_id,
        status: data.status_live,
      });
    };

    socket.on('device:update', onUpdate);
    socket.on('device:status', onStatus);

    // --- Cleanup ------------------------------------------------
    return () => {
      socket.off('connect', subscribe);
      socket.off('device:update', onUpdate);
      socket.off('device:status', onStatus);
      // Socket itself stays connected — shared across the app.
      // Disconnected only on logout (disconnectSocket).
    };
  }, [queryClient, selectedAgencyId, isSuperadmin]);
}