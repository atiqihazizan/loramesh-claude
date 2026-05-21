// middleware/audit.js
// Lightweight request logging — tags request with ID, logs method+status+duration.

/**
 * Per-request logger. Mount EARLY (right after CORS).
 */
export function requestLogger(req, res, next) {
  const start = Date.now();
  const reqId = req.headers['x-request-id'] || shortId(8);
  req.requestId = reqId;
  res.setHeader('x-request-id', reqId);

  res.on('finish', () => {
    const ms = Date.now() - start;
    const userId = req.user?.id ?? '-';
    const agencyCode = req.agency?.code || req.user?.agency?.code || '-';
    const statusEmoji = res.statusCode >= 500 ? '🔴' : res.statusCode >= 400 ? '🟡' : '🟢';
    console.log(
      `[req] ${statusEmoji} ${req.method.padEnd(6)} ${req.originalUrl} → ${res.statusCode} (${ms}ms) reqId=${reqId} user=${userId} agency=${agencyCode}`
    );
  });

  next();
}

function shortId(len) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}