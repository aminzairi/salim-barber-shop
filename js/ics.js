/* =============================================================================
 * ICS CALENDAR FILE — "Add to calendar" on the confirmation screen.
 * Times carry TZID=Africa/Tunis (resolved by Google/Apple/Outlook natively).
 * ========================================================================== */
import { SHOP } from './config.js';
import { toMin } from './shopTime.js';

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/** dateStr "YYYY-MM-DD" + "HH:MM" + duration → local DTSTART/DTEND stamps. */
const stamp = (dateStr, hhmm) => {
  const [y, mo, d] = dateStr.split('-');
  const h = String(Math.floor(toMin(hhmm) / 60)).padStart(2, '0');
  const mi = String(toMin(hhmm) % 60).padStart(2, '0');
  return `${y}${mo}${d}T${h}${mi}00`;
};

/**
 * @param {object} b {ref, title, dateStr, time, durationMin, description, lang}
 * @returns full text/calendar content (RFC 5545)
 */
export function buildIcs(b) {
  const endMin = toMin(b.time) + b.durationMin;
  const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
  const now = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Salim Barber Shop//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${b.ref}@salimbarber.tn`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=${SHOP.timezone}:${stamp(b.dateStr, b.time)}`,
    `DTEND;TZID=${SHOP.timezone}:${stamp(b.dateStr, endTime)}`,
    `SUMMARY:${esc(b.title)}`,
    `LOCATION:${esc(`${SHOP.name} — ${SHOP.address}`)}`,
    `DESCRIPTION:${esc(b.description)}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/** Trigger a browser download of the .ics file. */
export function downloadIcs(b) {
  const blob = new Blob([buildIcs(b)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${b.ref}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
