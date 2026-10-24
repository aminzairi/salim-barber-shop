/* =============================================================================
 * WHATSAPP MESSAGE BUILDER — shared by Phase 1 (booking request) and Phase 2
 * (post-confirmation message). Message language = active UI language.
 * ========================================================================== */
import { SHOP } from './config.js';
import { translate, formatDate, formatTime } from './i18n.js';

export function shopNameIn(lang) {
  return lang === 'ar' ? SHOP.nameAr : SHOP.name;
}

/** Phase 1 request: service / date / time / name in the active language. */
export function buildBookingMessage(lang, { serviceName, dateStr, time, name }) {
  return translate(lang, 'whatsapp.bookingMsg', {
    shop: shopNameIn(lang),
    service: serviceName,
    date: formatDate(dateStr, lang),
    time: formatTime(time, lang),
    name: name.trim(),
  });
}

/** Phase 2 confirmation: ref + details. */
export function buildConfirmMessage(lang, { ref, serviceName, dateStr, time }) {
  return translate(lang, 'whatsapp.confirmMsg', {
    shop: shopNameIn(lang),
    ref,
    service: serviceName,
    date: formatDate(dateStr, lang),
    time: formatTime(time, lang),
  });
}

/** wa.me deep link (works on mobile + desktop WhatsApp Web). */
export function waLink(message) {
  return `https://wa.me/${SHOP.whatsapp}?text=${encodeURIComponent(message)}`;
}
