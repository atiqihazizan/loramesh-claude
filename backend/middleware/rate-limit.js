// middleware/rate-limit.js
// Per-IP request rate limiting.

import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

/**
 * General API limiter — applied globally to all /api/*.
 */
export const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

/**
 * Tight limiter for auth endpoints — prevent brute force.
 * 10 failed attempts per 15 min per IP. Successful logins don't count.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    error: 'Too many login attempts, please try again in 15 minutes',
  },
});

/**
 * Even tighter for password change — 5 per hour.
 */
export const passwordChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many password change attempts, try again in 1 hour',
  },
});