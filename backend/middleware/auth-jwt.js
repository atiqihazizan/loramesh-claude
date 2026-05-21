// middleware/auth-jwt.js
// Verify JWT for frontend (web/React) requests.
// Attaches req.user with: id, username, level, agency, must_change_password.

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import prisma from '../lib/prisma.js';

function extractToken(req) {
  const auth = req.headers.authorization;
  if (auth) {
    if (auth.startsWith('Bearer ')) return auth.slice(7);
    if (auth.length > 10) return auth;
  }
  if (req.body?.token) return req.body.token;
  if (req.query?.token) return req.query.token;
  return null;
}

/**
 * Load user from DB by JWT payload. Throws on invalid token.
 * Returns null if user disabled/missing.
 */
async function loadUserFromToken(token) {
  const payload = jwt.verify(token, env.JWT_SECRET);

  const user = await prisma.users.findUnique({
    where: { id: payload.id },
    include: {
      level: true,
      user_agencies: {
        include: { agency: true },
        take: 1, // current design: one agency per user
      },
    },
  });

  if (!user) return null;
  if (user.status === 'banned' || user.status === 'disabled') return null;

  const agencyLink = user.user_agencies[0];
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    level: {
      id: user.level.id,
      code: user.level.code,
      name: user.level.name,
      rank: user.level.rank,
    },
    agency: agencyLink?.agency
      ? {
          id: agencyLink.agency.id,
          code: agencyLink.agency.code,
          name: agencyLink.agency.name,
        }
      : null,
    must_change_password: user.must_change_password === true,
  };
}

/**
 * REQUIRED auth. 401 if no/invalid token.
 */
export async function authenticateJwt(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const user = await loadUserFromToken(token);
    if (!user) {
      return res
        .status(401)
        .json({ error: 'User not found or disabled', code: 'USER_INVALID' });
    }
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res
        .status(401)
        .json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res
        .status(401)
        .json({ error: 'Invalid token', code: 'TOKEN_INVALID' });
    }
    console.error('[auth-jwt] Unexpected error:', err.message);
    return res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * OPTIONAL auth — attach req.user if valid, otherwise let through with req.user=null.
 * Useful for public endpoints that show extra info to logged-in users.
 */
export async function tryAuthenticateJwt(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    req.user = await loadUserFromToken(token);
  } catch {
    req.user = null;
  }
  next();
}