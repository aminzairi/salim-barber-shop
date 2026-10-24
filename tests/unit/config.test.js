/* CONFIG GUARDS — the business data file stays coherent (maintainability). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHOP } from '../../js/config.js';

test('opening hours: 7 entries, Sunday closed, weekdays 09:00–20:00', () => {
  assert.equal(SHOP.hours.length, 7);
  assert.equal(SHOP.hours[0], null);
  for (let d = 1; d <= 6; d += 1) {
    assert.equal(SHOP.hours[d].open, '09:00');
    assert.equal(SHOP.hours[d].close, '20:00');
  }
});

test('services: known ids, sane durations and positive prices', () => {
  const ids = SHOP.services.map((s) => s.id);
  assert.deepEqual(ids, ['haircut', 'beard', 'haircut-beard', 'kids']);
  SHOP.services.forEach((s) => {
    assert.ok(s.duration >= 10 && s.duration <= 120, s.id);
    assert.ok(s.price > 0 && s.price <= 200, s.id);
  });
});

test('phone numbers are digits-only international format', () => {
  assert.ok(/^\+?\d+$/.test(SHOP.phone));
  assert.ok(/^\d+$/.test(SHOP.whatsapp));
});

test('barbers referenced by gallery/cards exist', () => {
  SHOP.barbers.forEach((b) => assert.ok(b.id && b.photo));
});

test('timezone is explicitly Africa/Tunis', () => {
  assert.equal(SHOP.timezone, 'Africa/Tunis');
});

test('cancellation window and slot step are configured', () => {
  assert.equal(SHOP.cancellationWindowHours, 3);
  assert.equal(SHOP.slotStepMinutes, 15);
});
