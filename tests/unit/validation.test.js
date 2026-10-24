/* VALIDATION — names, +216 phones, emails, booking dates, honeypot. FR-13/14 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateName, normalizePhone, validateEmail, sanitizeNote,
  validateBookingDate, isSpam,
} from '../../js/validation.js';
import { SHOP } from '../../js/config.js';

const NOW = { date: '2026-10-24', weekday: 6 }; // a Saturday

test('names: 3–80 chars after trim', () => {
  assert.equal(validateName('  Ahmed Ben Salah  '), true);
  assert.equal(validateName('ab'), false);
  assert.equal(validateName('   '), false);
  assert.equal(validateName('x'.repeat(81)), false);
});

test('+216 numbers: valid formats normalize to E.164', () => {
  assert.equal(normalizePhone('22 123 456'), '+21622123456');
  assert.equal(normalizePhone('22123456'), '+21622123456');
  assert.equal(normalizePhone('+216 98 765 432'), '+21698765432');
  assert.equal(normalizePhone('00216-45-123-987'), '+21645123987');
  assert.equal(normalizePhone('21655123456'), '+21655123456');
});

test('+216 numbers: invalid inputs rejected', () => {
  // landline prefix 7, wrong length, letters, foreign number
  assert.equal(normalizePhone('71 123 456'), null);
  assert.equal(normalizePhone('22 123 45'), null);
  assert.equal(normalizePhone('22 123 4567'), null);
  assert.equal(normalizePhone('abc'), null);
  assert.equal(normalizePhone('+33612345678'), null);
  assert.equal(normalizePhone(''), null);
  assert.equal(normalizePhone('0 123 45'), null);
});

test('emails: simple RFC-ish check', () => {
  assert.equal(validateEmail('ahmed@example.tn'), true);
  assert.equal(validateEmail('a.b+c@shop.co.uk'), true);
  assert.equal(validateEmail('no-at-sign'), false);
  assert.equal(validateEmail('a@b'), false);
  assert.equal(validateEmail('a b@c.d'), false);
});

test('notes are trimmed and capped at 500 chars', () => {
  assert.equal(sanitizeNote('  hello  '), 'hello');
  assert.equal(sanitizeNote('x'.repeat(900)).length, 500);
});

test('booking date: past, closed Sunday, valid Monday', () => {
  assert.equal(validateBookingDate('2026-10-23', SHOP, NOW), 'datePast');   // Friday before today
  assert.equal(validateBookingDate('2026-10-25', SHOP, NOW), 'dateClosed'); // Sunday
  assert.equal(validateBookingDate('2026-10-26', SHOP, NOW), null);         // Monday OK
  assert.equal(validateBookingDate('bogus', SHOP, NOW), 'date');
});

test('booking date: beyond the booking horizon rejected', () => {
  assert.equal(validateBookingDate('2026-12-31', SHOP, NOW), 'datePast');   // > maxAdvanceDays
});

test('honeypot: empty passes, filled flags spam', () => {
  assert.equal(isSpam(''), false);
  assert.equal(isSpam('buy seo links'), true);
});
