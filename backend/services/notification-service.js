// notification-service.js — in-app notifications + Socket.IO push

import prisma from '../lib/prisma.js';
import { getIO } from '../realtime/socket-server.js';
import { ROLES } from '../config/constants.js';

/**
 * @param {{ userId: number, type: string, title: string, body?: string|null, link?: string|null }} params
 */
export async function createNotification({ userId, type, title, body = null, link = null }) {
  const notif = await prisma.notifications.create({
    data: {
      user_id: userId,
      type,
      title,
      body,
      link,
    },
  });

  getIO()?.to(`user:${userId}`).emit('notification:new', notif);
  return notif;
}

/**
 * Notify superadmins + agency admins when a device self-registers pending approval.
 */
export async function notifyDevicePending({ deviceId, deviceName, agencyId }) {
  const superadmins = await prisma.users.findMany({
    where: { level: { code: ROLES.SUPERADMIN } },
    select: { id: true },
  });

  const agencyAdmins = await prisma.users.findMany({
    where: {
      level: { code: ROLES.ADMIN_AGENCY },
      user_agencies: { some: { agency_id: agencyId } },
    },
    select: { id: true },
  });

  const recipientIds = [
    ...new Set([...superadmins.map((u) => u.id), ...agencyAdmins.map((u) => u.id)]),
  ];

  const body = `${deviceName} (${deviceId})`;
  const link = '/settings/devices';

  await Promise.all(
    recipientIds.map((userId) =>
      createNotification({
        userId,
        type: 'device_pending',
        title: 'Device baru menunggu kelulusan',
        body,
        link,
      })
    )
  );
}

/**
 * @param {number} userId
 * @param {{ limit?: number }} [opts]
 */
export async function listNotifications(userId, { limit = 30 } = {}) {
  const [notifications, unread_count] = await Promise.all([
    prisma.notifications.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: limit,
    }),
    prisma.notifications.count({
      where: { user_id: userId, is_read: false },
    }),
  ]);

  return { notifications, unread_count };
}

/**
 * @param {number} notifId
 * @param {number} userId
 */
export async function markRead(notifId, userId) {
  const row = await prisma.notifications.findFirst({
    where: { id: notifId, user_id: userId },
  });

  if (!row) {
    const err = new Error('Notification not found');
    err.status = 404;
    throw err;
  }

  if (row.is_read) {
    return row;
  }

  return prisma.notifications.update({
    where: { id: notifId },
    data: { is_read: true, read_at: new Date() },
  });
}

/**
 * @param {number} userId
 */
export async function markAllRead(userId) {
  await prisma.notifications.updateMany({
    where: { user_id: userId, is_read: false },
    data: { is_read: true, read_at: new Date() },
  });
  return { ok: true };
}
