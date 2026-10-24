/* =============================================================================
 * DATE/TIME HELPERS — all booking times are naive "YYYY-MM-DD" / "HH:MM"
 * strings expressed in SHOP.timezone (Africa/Tunis), explicitly, everywhere.
 * Never use the visitor's local timezone for business logic.
 * ========================================================================== */
import { SHOP } from './config.js';

/** Current date/time in the shop's timezone, regardless of visitor's clock. */
export function shopNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SHOP.timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour') === '24' ? '00' : get('hour')}:${get('minute')}`,
    weekday: weekdays.indexOf(get('weekday')),
  };
}

/** "YYYY-MM-DD" → weekday 0 (Sunday) … 6 (Saturday). Pure. */
export function weekdayOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** date + n days → "YYYY-MM-DD". Pure. */
export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** "HH:MM" → minutes since midnight. */
export const toMin = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** minutes since midnight → "HH:MM". */
export const fromMin = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** True if dateStr is today or later, in shop time. */
export function isDateFutureOrToday(dateStr, now = null) {
  const n = now || shopNow();
  return dateStr >= n.date;
}

/** UTC timestamp of a shop-local date+time (Tunisia = UTC+1, no stable DST). */
export function shopToUtcMs(dateStr, hhmm) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, mo - 1, d, Math.floor(toMin(hhmm) / 60) - 1, toMin(hhmm) % 60);
}
