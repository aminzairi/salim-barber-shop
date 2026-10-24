/* ICS EXPORT + DATE HELPERS — calendar file correctness (FR-22). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIcs } from '../../js/ics.js';
import { weekdayOf, addDays, toMin, fromMin, shopToUtcMs } from '../../js/shopTime.js';

test('ics contains TZID Africa/Tunis start/end and the reference as UID', () => {
  const ics = buildIcs({
    ref: 'SB-ABC123', title: 'Haircut — Salim Barber Shop',
    dateStr: '2026-10-26', time: '14:30', durationMin: 30,
    description: 'Reference: SB-ABC123',
  });
  assert.ok(ics.includes('BEGIN:VCALENDAR'));
  assert.ok(ics.includes('DTSTART;TZID=Africa/Tunis:20261026T143000'));
  assert.ok(ics.includes('DTEND;TZID=Africa/Tunis:20261026T150000'));
  assert.ok(ics.includes('UID:SB-ABC123@salimbarber.tn'));
  assert.ok(ics.includes('SUMMARY:Haircut'));
  assert.ok(ics.endsWith('END:VCALENDAR'));
});

test('ics escapes semicolons/commas and uses CRLF line endings', () => {
  const ics = buildIcs({
    ref: 'SB-1', title: 'A;B,C', dateStr: '2026-10-26', time: '09:00', durationMin: 20, description: 'x',
  });
  assert.ok(ics.includes('SUMMARY:A\\;B\\,C'));
  assert.ok(ics.includes('\r\n'));
});

test('date helpers: weekday, addDays, minute conversions', () => {
  assert.equal(weekdayOf('2026-10-25'), 0);  // Sunday
  assert.equal(weekdayOf('2026-10-26'), 1);  // Monday
  assert.equal(addDays('2026-10-31', 1), '2026-11-01'); // month rollover
  assert.equal(addDays('2026-12-31', 1), '2027-01-01'); // year rollover
  assert.equal(toMin('20:00'), 1200);
  assert.equal(fromMin(75), '01:15');
});

test('shop-local time converts to UTC with the +01:00 offset', () => {
  // 2026-10-26 14:30 Tunis = 13:30 UTC
  const ms = shopToUtcMs('2026-10-26', '14:30');
  const d = new Date(ms);
  assert.equal(d.toISOString(), '2026-10-26T13:30:00.000Z');
});
