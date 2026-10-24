/* I18N + TRANSLATIONS — key parity, interpolation, detection, RTL. FR-01..FR-04 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import translations from '../../js/translations/index.js';
import { detectLanguage, translate, SUPPORTED, DEFAULT_LANG, RTL_LANGS } from '../../js/i18n.js';

const KEYS = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    (v && typeof v === 'object' && !Array.isArray(v)) ? KEYS(v, `${prefix}${k}.`) : [`${prefix}${k}`]);

test('all three locales exist', () => {
  SUPPORTED.forEach((l) => assert.ok(translations[l], `missing ${l}`));
});

test('EN, FR and AR expose exactly the same key set (no missing strings)', () => {
  const en = KEYS(translations.en).sort();
  const fr = KEYS(translations.fr).sort();
  const ar = KEYS(translations.ar).sort();
  assert.deepEqual(fr, en, 'FR key set differs from EN');
  assert.deepEqual(ar, en, 'AR key set differs from EN');
});

test('FAQ has 6 items in every language', () => {
  SUPPORTED.forEach((l) => assert.equal(translations[l].faq.items.length, 6));
});

test('interpolation replaces {placeholders}', () => {
  assert.equal(translate('en', 'services.min', { n: 30 }), '30 min');
  assert.equal(translate('fr', 'walkin.eta', { minutes: 25 }).includes('25'), true);
  assert.equal(translate('ar', 'loyalty.title').length > 3, true);
});

test('missing key falls back to EN, then to the key itself', () => {
  // simulate by translating a key that exists in EN only is impossible (parity
  // tested above) — so assert the final fallback path with a bogus key:
  assert.equal(translate('fr', 'no.such.key'), 'no.such.key');
});

test('browser detection order: explicit locales, first supported wins', () => {
  assert.equal(detectLanguage(['fr-FR', 'en-US']), 'fr');
  assert.equal(detectLanguage(['de-DE', 'fr-FR']), 'fr');
  assert.equal(detectLanguage(['ar-TN']), 'ar');
  assert.equal(detectLanguage(['en-GB']), 'en');
  assert.equal(detectLanguage(['de-DE', 'es-ES']), DEFAULT_LANG, 'unsupported → FR default');
});

test('saved language wins over browser detection', () => {
  assert.equal(detectLanguage(['fr-FR'], 'ar'), 'ar');
  assert.equal(detectLanguage(['ar-TN'], 'invalid'), 'ar', 'invalid saved value falls back to locales');
});

test('Arabic is the only RTL language', () => {
  assert.deepEqual(RTL_LANGS, ['ar']);
});
