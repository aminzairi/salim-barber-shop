/* SLOT GENERATION — the booking engine core. FR-02, FR-03, NFR date logic. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHOP } from '../../js/config.js';
import { candidateSlots, availabilityFor, pickBarber } from '../../js/slots.js';

const MON = { open: '09:00', close: '20:00' }; // weekday hours from config

test('candidate grid respects step and service duration fitting before closing', () => {
  const slots = candidateSlots(MON, 30, 15);
  assert.equal(slots[0].start, '09:00');
  assert.equal(slots.at(-1).end, '20:00');            // 19:30 + 30 = close
  assert.equal(slots.at(-1).start, '19:30');
  assert.equal(slots.length, (11 * 60) / 15 - 1);     // 09:00..19:30
});

test('closed day yields no candidates', () => {
  assert.deepEqual(candidateSlots(null, 30, 15), []);
});

test('long service stops earlier than short one', () => {
  const long = candidateSlots(MON, 45, 15);
  assert.equal(long.at(-1).start, '19:15');           // 19:15 + 45 = 20:00
});

test('availability excludes overlapping bookings for that barber', () => {
  const busy = [{ start: '10:00', end: '10:30', barberId: 'salim' }];
  const { slots } = availabilityFor(SHOP, '2026-10-26', busy, { serviceId: 'haircut', barberId: 'salim' });
  assert.ok(!slots.includes('10:00'), 'conflicting start removed');
  assert.ok(!slots.includes('09:45'), 'slot overlapping a busy interval removed');
  assert.ok(slots.includes('10:30'), 'first slot after the booking kept');
});

test('same interval for another barber stays free', () => {
  const busy = [{ start: '10:00', end: '10:30', barberId: 'salim' }];
  const { slots, freeBarbersBySlot } = availabilityFor(SHOP, '2026-10-26', busy, { serviceId: 'haircut', barberId: 'karim' });
  assert.ok(slots.includes('10:00'));
  assert.deepEqual(freeBarbersBySlot['10:00'], ['karim']);
});

test('"any barber" = union: slot offered while at least one barber free', () => {
  const busy = [
    { start: '10:00', end: '10:30', barberId: 'salim' },
    { start: '10:00', end: '10:30', barberId: 'karim' },
  ];
  const { slots, freeBarbersBySlot } = availabilityFor(SHOP, '2026-10-26', busy, { serviceId: 'haircut', barberId: 'any' });
  assert.ok(slots.includes('10:00'), 'yassine still free');
  assert.deepEqual(freeBarbersBySlot['10:00'], ['yassine']);
});

test('all barbers busy → slot gone', () => {
  const busy = SHOP.barbers.map((b) => ({ start: '10:00', end: '10:30', barberId: b.id }));
  const { slots } = availabilityFor(SHOP, '2026-10-26', busy, { serviceId: 'haircut', barberId: 'any' });
  assert.ok(!slots.includes('10:00'));
});

test('cancelled bookings do not block slots', () => {
  const busy = [];
  const { slots } = availabilityFor(SHOP, '2026-10-26', busy, { serviceId: 'haircut', barberId: 'any' });
  assert.ok(slots.includes('10:00'));
});

test('minimum lead time on today: recent slots filtered', () => {
  const now = { date: '2026-10-26', time: '14:40' }; // Monday
  const { slots } = availabilityFor(SHOP, '2026-10-26', [], { serviceId: 'haircut', barberId: 'any', now });
  assert.ok(!slots.includes('15:00'), 'slot within lead time removed');
  assert.ok(slots.includes('15:15'), 'first grid slot after 15:10 lead cutoff kept');
});

test('Sunday (closed) has no availability', () => {
  const { slots } = availabilityFor(SHOP, '2026-10-25', [], { serviceId: 'haircut', barberId: 'any' }); // a Sunday
  assert.deepEqual(slots, []);
});

test('unknown service → empty availability', () => {
  assert.deepEqual(availabilityFor(SHOP, '2026-10-26', [], { serviceId: 'nope', barberId: 'any' }).slots, []);
});

test('pickBarber chooses the least loaded barber', () => {
  const bookings = [
    { barberId: 'salim' }, { barberId: 'salim' }, { barberId: 'karim' },
  ];
  assert.equal(pickBarber(['salim', 'karim', 'yassine'], bookings, '10:00'), 'yassine');
});
