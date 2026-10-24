/* =============================================================================
 * I18N ENGINE — language detection, persistence, RTL switching, interpolation.
 * Pure logic is separated from DOM application so it is unit-testable.
 * Add a language: drop xx.json in translations/, add its code to SUPPORTED and
 * its font in styles.css. See docs/MAINTENANCE_GUIDE.md.
 * ========================================================================== */
import translations from './translations/index.js';

export const SUPPORTED = ['en', 'fr', 'ar'];
export const DEFAULT_LANG = 'fr'; // fallback when the browser language is unsupported
export const RTL_LANGS = ['ar'];
const STORAGE_KEY = 'sb_lang';

/* ---- Pure helpers (unit-tested) ------------------------------------------- */

/** Pick the best language from a browser locale list. */
export function detectLanguage(locales, saved) {
  if (saved && SUPPORTED.includes(saved)) return saved;
  for (const raw of locales || []) {
    const code = String(raw).toLowerCase().slice(0, 2);
    if (SUPPORTED.includes(code)) return code;
  }
  return DEFAULT_LANG;
}

/** Translate `key` with {placeholder} interpolation; falls back EN → key. */
export function translate(lang, key, params = {}) {
  let value = key.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : undefined), translations[lang]);
  if (value === undefined) {
    value = key.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : undefined), translations.en);
  }
  if (value === undefined) return key;
  if (typeof value !== 'string') return value; // arrays/objects handled by callers
  return value.replace(/\{(\w+)\}/g, (_, name) =>
    params[name] !== undefined ? String(params[name]) : `{${name}}`);
}

/* ---- Locale formatting ----------------------------------------------------- */
const INTL_LOCALE = { en: 'en-GB', fr: 'fr-FR', ar: 'ar-TN' };

/** "2026-10-24" + "HH:MM" → localized "Sat 24 Oct 2026 · 14:30" style strings. */
export function formatDate(dateStr, lang, opts = {}) {
  const d = new Date(`${dateStr}T00:00:00`);
  return new Intl.DateTimeFormat(INTL_LOCALE[lang] || 'en-GB', {
    weekday: opts.weekday ?? 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(d);
}
export function formatTime(hhmm, lang) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return new Intl.DateTimeFormat(INTL_LOCALE[lang] || 'en-GB', { hour: '2-digit', minute: '2-digit' }).format(d);
}

/* ---- Stateful part (browser only) ------------------------------------------ */
let currentLang = DEFAULT_LANG;

export const getLang = () => currentLang;
export const isRTL = (lang = currentLang) => RTL_LANGS.includes(lang);
export const t = (key, params) => translate(currentLang, key, params);

/** Apply translations to the DOM: data-i18n (text) and data-i18n-attr (attrs). */
function applyDom(lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = isRTL(lang) ? 'rtl' : 'ltr';
  document.title = translate(lang, 'meta.title');
  document.querySelector('meta[name="description"]')?.setAttribute('content', translate(lang, 'meta.description'));

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const val = translate(lang, el.dataset.i18n);
    if (typeof val === 'string') el.textContent = val;
  });
  document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.dataset.i18nAttr.split(';').forEach((pair) => {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, translate(lang, key));
    });
  });
}

/** Switch language: persist, apply, notify subscribers (Observer pattern). */
export function setLanguage(lang) {
  if (!SUPPORTED.includes(lang)) lang = DEFAULT_LANG;
  currentLang = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* private mode */ }
  // Privacy-friendly analytics hook (no cookies, no PII) — see docs/MAINTENANCE_GUIDE.md
  window.__sbAnalytics?.('language', { lang });
  applyDom(lang);
  document.dispatchEvent(new CustomEvent('sb:langchange', { detail: { lang } }));
}

export function initLanguage() {
  let saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
  const lang = detectLanguage(navigator.languages || [navigator.language], saved);
  currentLang = lang;
  applyDom(lang);
  window.__sbAnalytics?.('language', { lang });
  return lang;
}
