// middleware/must-change-password.js
// If user.must_change_password is true, block all API access except:
//   GET  /api/auth/me        — needed to know current state
//   POST /api/auth/password  — the change endpoint itself
//   POST /api/auth/logout    — allow log out
// Mount AFTER authenticateJwt.

const ALLOWED = [
  { method: 'GET',  path: '/api/auth/me' },
  { method: 'POST', path: '/api/auth/password' },
  { method: 'POST', path: '/api/auth/logout' },
];

function isAllowed(req) {
  const path = req.originalUrl.split('?')[0];
  return ALLOWED.some((p) => p.method === req.method && p.path === path);
}

export function enforcePasswordChange(req, res, next) {
  if (!req.user) return next();
  if (!req.user.must_change_password) return next();
  if (isAllowed(req)) return next();

  return res.status(403).json({
    error: 'Password change required before continuing',
    code: 'MUST_CHANGE_PASSWORD',
  });
}