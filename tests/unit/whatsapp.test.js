/* WHATSAPP MESSAGE BUILDER — correct message per language (FR-09..11). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBookingMessage, buildConfirmMessage, waLink, shopNameIn } from '../../js/whatsapp.js';
import { shopNow } from '../../js/shopTime.js';

const dateStr = shopNow().date; // any valid date works; message only embeds it

test('EN booking message contains service, date, time and name', () => {
  const m = buildBookingMessage('en', { serviceName: 'Haircut', dateStr, time: '14:30', name: 'Ahmed' });
  assert.ok(m.includes('Haircut'));
  assert.ok(m.includes('14:30'));
  assert.ok(m.includes('Ahmed'));
  assert.ok(m.includes('Salim Barber Shop'));
});

test('FR booking message is French and complete', () => {
  const m = buildBookingMessage('fr', { serviceName: 'Coupe', dateStr, time: '10:00', name: 'Marc' });
  assert.ok(m.includes('Coupe'));
  assert.ok(m.startsWith('Bonjour Salim Barber Shop'));
  assert.ok(m.includes('Marc'));
});

test('AR booking message uses the Arabic shop name and is RTL text', () => {
  const m = buildBookingMessage('ar', { serviceName: 'قصة شعر', dateStr, time: '16:00', name: 'أحمد' });
  assert.ok(m.includes('صالون سليم للحلاقة'));
  assert.ok(m.includes('قصة شعر'));
  assert.ok(m.includes('أحمد'));
});

test('confirmation message embeds the reference', () => {
  ['en', 'fr', 'ar'].forEach((lang) => {
    const m = buildConfirmMessage(lang, { ref: 'SB-TEST01', serviceName: 'X', dateStr, time: '09:00' });
    assert.ok(m.includes('SB-TEST01'), lang);
  });
});

test('shop name switches for Arabic', () => {
  assert.equal(shopNameIn('ar'), 'صالون سليم للحلاقة');
  assert.equal(shopNameIn('fr'), 'Salim Barber Shop');
});

test('wa.me link URL-encodes the message and targets the shop number', () => {
  const link = waLink('Bonjour Salim! ✓');
  assert.ok(link.startsWith('https://wa.me/21622345678?text='));
  assert.ok(link.includes(encodeURIComponent('Bonjour')));
});
