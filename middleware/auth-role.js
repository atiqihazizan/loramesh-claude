// middleware/auth-role.js
// Role-based access guards. Mount AFTER authenticateJwt.

import { ROLES, isRoleAtLeast } from '../config/constants.js';

/**
 * Require user to have at least the given role rank.
 * Usage: router.post('/foo', authenticateJwt, requireRole('ADMIN_AGENCY'), handler)
 */
export function requireRole(minRoleCode) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!isRoleAtLeast(req.user.level?.code, minRoleCode)) {
      return res.status(403).json({
        error: `Forbidden — requires ${minRoleCode} or higher`,
        your_role: req.user.level?.code,
      });
    }
    next();
  };
}

/**
 * Require user to be SUPERADMIN exactly.
 */
export function requireSuperadmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.level?.code !== ROLES.SUPERADMIN) {
    return res.status(403).json({ error: 'Forbidden — SUPERADMIN only' });
  }
  next();
}

/**
 * Require user to be ADMIN_AGENCY or higher (includes SUPERADMIN).
 */
export const requireAgencyAdmin = requireRole(ROLES.ADMIN_AGENCY);

/**
 * Require user to belong to an agency.
 * SUPERADMIN may have no agency; for routes that absolutely need agency
 * context, combine with requireAgencyContext.
 */
export function requireAgencyContext(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (!req.user.agency?.id) {
    return res.status(403).json({ error: 'No agency assigned to user' });
  }
  next();
}

/**
 * Helper for use INSIDE route handlers.
 * Returns true if user can access resource belonging to `resourceAgencyId`.
 * SUPERADMIN always passes; others must match their own agency.
 */
export function canAccessAgency(user, resourceAgencyId) {
  if (!user) return false;
  if (user.level?.code === ROLES.SUPERADMIN) return true;
  return user.agency?.id === resourceAgencyId;
}