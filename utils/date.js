// utils/date.js
// Date parsing utilities. Tracking payloads come in TWO formats:
//   - Sensor/Gateway:  "21-05-2026 10:04:59"  (DD-MM-YYYY HH:mm:ss)
//   - Mobile (Flutter): "2026-05-21 10:04:03"  (YYYY-MM-DD HH:mm:ss)
//   - Some payloads:    epoch millis (number) e.g. ts: 1779329043871
// This module detects and parses all of them safely.

/**
 * Parse a tracking timestamp into a Date.
 * Returns null if unparseable.
 *
 * @param {string|number|Date|null} value
 * @returns {Date|null}
 */
export function parseTrackingDate(value) {
  if (value === null || value === undefined || value === '') return null;

  // Already a Date
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }

  // Epoch millis (number, or numeric string of 13 digits)
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  const str = String(value).trim();

  // Numeric string → epoch
  if (/^\d{10,14}$/.test(str)) {
    const num = parseInt(str, 10);
    // 10 digits = seconds, 13 = millis
    const ms = str.length <= 10 ? num * 1000 : num;
    const d = new Date(ms);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  // DD-MM-YYYY HH:mm:ss  (sensor/gateway format)
  let m = str.match(/^(\d{2})-(\d{2})-(\d{4})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (m) {
    const [, dd, mm, yyyy, hh, min, ss] = m;
    const d = new Date(
      Number(yyyy), Number(mm) - 1, Number(dd),
      Number(hh), Number(min), Number(ss)
    );
    return Number.isFinite(d.getTime()) ? d : null;
  }

  // YYYY-MM-DD HH:mm:ss  (mobile format)
  m = str.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (m) {
    const [, yyyy, mm, dd, hh, min, ss] = m;
    const d = new Date(
      Number(yyyy), Number(mm) - 1, Number(dd),
      Number(hh), Number(min), Number(ss)
    );
    return Number.isFinite(d.getTime()) ? d : null;
  }

  // DD-MM-YYYY only (no time)
  m = str.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return Number.isFinite(d.getTime()) ? d : null;
  }

  // Last resort — let JS try (handles ISO 8601 etc.)
  const d = new Date(str);
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * Format Date → "YYYY-MM-DD HH:mm:ss" (MySQL-friendly).
 */
export function formatMysqlDateTime(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return null;
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ` +
    `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`
  );
}

/**
 * Is the date within `seconds` from now? Useful for "is this fresh?" checks.
 */
export function isWithinSeconds(date, seconds) {
  if (!(date instanceof Date)) return false;
  return Date.now() - date.getTime() <= seconds * 1000;
}
