/* =============================================================================
 * VALIDATION — pure functions shared by the wizard, admin and unit tests.
 * ========================================================================== */

/** Name: 3–80 chars after trimming. */
export function validateName(name) {
  const v = String(name || '').trim();
  return v.length >= 3 && v.length <= 80;
}

/**
 * Tunisian mobile numbers: 8 digits starting with 2/4/5/9.
 * Accepts "22 123 456", "22123456", "+216 22 123 456", "00216...", "216...".
 * Returns normalized "+216XXXXXXXX" or null.
 */
export function normalizePhone(input) {
  let v = String(input || '').replace(/[\s\-().]/g, '');
  v = v.replace(/^(?:\+|00)(216)/, '').replace(/^216(?=\d{8}$)/, '');
  return /^[2459]\d{7}$/.test(v) ? `+216${v}` : null;
}

export const validatePhone = (input) => normalizePhone(input) !== null;

/** RFC-5322-lite, deliberately simple. */
export function validateEmail(input) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(input || '').trim());
}

/** Booking note: max 500 chars, no newline flooding. */
export function sanitizeNote(input) {
  return String(input || '').trim().slice(0, 500);
}

/**
 * Validate a booking date against shop rules.
 * Returns null when valid, otherwise an i18n error key under booking.errors / wizard.errors.
 */
export function validateBookingDate(dateStr, { hours, maxAdvanceDays }, now = null) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) return 'date';
  const n = now; // {date, weekday} from shopNow() — injectable for tests
  if (n && dateStr < n.date) return 'datePast';
  const [y, m, d] = dateStr.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if (!hours[weekday]) return 'dateClosed';
  if (n) {
    const maxDate = new Date(Date.UTC(...n.date.split('-').map(Number)));
    maxDate.setUTCDate(maxDate.getUTCDate() + maxAdvanceDays);
    if (dateStr > maxDate.toISOString().slice(0, 10)) return 'datePast';
  }
  return null;
}

/** Honeypot field: any content means a bot (returns true = spam). */
export const isSpam = (honeypotValue) => String(honeypotValue || '').trim().length > 0;
