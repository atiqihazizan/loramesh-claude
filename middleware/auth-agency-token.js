// middleware/auth-agency-token.js
// Verify agency_token for Flutter/APK requests. O(1) cache lookup.
// Attaches req.agency = {id, code, name, token}.

import { getAgencyFromCache } from '../lib/cache/agency-cache.js';

function extractAgencyToken(req) {
  // Priority: x-agency-token header > Authorization > body > query
  if (req.headers['x-agency-token']) return req.headers['x-agency-token'];

  const auth = req.headers.authorization;
  if (auth) {
    if (auth.startsWith('Bearer ')) return auth.slice(7);
    if (auth.length > 10) return auth;
  }

  if (req.body?.agency_token) return req.body.agency_token;
  if (req.query?.agency_token) return req.query.agency_token;

  return null;
}

/**
 * Required: agency token must be valid (exists in cache + agency active).
 */
export function authenticateAgencyToken(req, res, next) {
  const token = extractAgencyToken(req);
  if (!token) {
    return res.status(401).json({ error: 'No agency token provided' });
  }

  const agency = getAgencyFromCache(token);
  if (!agency) {
    return res.status(401).json({ error: 'Invalid agency token' });
  }

  req.agency = {
    id: agency.agencyId,
    code: agency.agencyCode,
    name: agency.agencyName,
    token,
  };
  next();
}