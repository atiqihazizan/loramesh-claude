// realtime/socket-handlers.js
// Event handlers untuk setiap socket connection.

import { SOCKET_EVENTS, ROLES } from '../config/constants.js';
import { getLiveSnapshot } from '../services/tracking-service.js';

/**
 * Daftar semua event handler untuk satu socket.
 */
export function registerSocketHandlers(io, socket) {
  const user = socket.data.user;

  // --------------------------------------------
  // client minta snapshot semasa (initial map load)
  // --------------------------------------------
  socket.on('request:snapshot', async (payload, ack) => {
    try {
      // Tentukan agency
      let agencyId = user.agency?.id;
      if (user.level === ROLES.SUPERADMIN && payload?.agency_id) {
        agencyId = parseInt(payload.agency_id, 10);
      }
      if (!agencyId) {
        if (typeof ack === 'function') ack({ ok: false, error: 'No agency' });
        return;
      }

      const devices = await getLiveSnapshot(agencyId);
      if (typeof ack === 'function') {
        ack({ ok: true, devices });
      } else {
        socket.emit(SOCKET_EVENTS.DEVICE_BATCH, { devices });
      }
    } catch (err) {
      console.error('[socket] snapshot error:', err.message);
      if (typeof ack === 'function') ack({ ok: false, error: 'Internal error' });
    }
  });

  // --------------------------------------------
  // SUPERADMIN tukar agency room (untuk monitor agency lain)
  // --------------------------------------------
  socket.on('subscribe:agency', (payload, ack) => {
    if (user.level !== ROLES.SUPERADMIN) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Forbidden' });
      return;
    }
    const agencyId = parseInt(payload?.agency_id, 10);
    if (!agencyId) {
      if (typeof ack === 'function') ack({ ok: false, error: 'agency_id required' });
      return;
    }

    // Tinggalkan semua agency room lama
    for (const room of socket.rooms) {
      if (room.startsWith('agency:')) socket.leave(room);
    }
    socket.join(`agency:${agencyId}`);
    console.log(`[socket] ${user.username} switched to agency:${agencyId}`);
    if (typeof ack === 'function') ack({ ok: true, agency_id: agencyId });
  });

  // --------------------------------------------
  // ping/pong ringkas (debug)
  // --------------------------------------------
  socket.on('ping:check', (payload, ack) => {
    if (typeof ack === 'function') ack({ ok: true, ts: Date.now() });
  });
}
