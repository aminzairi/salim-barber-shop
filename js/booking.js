/* =============================================================================
 * PHASE 1 BOOKING FORM — WhatsApp-first.
 * Builds a pre-filled WhatsApp message in the ACTIVE language and opens wa.me.
 * Validation messages come from translations (booking.errors.*).
 * ========================================================================== */
import { SHOP } from './config.js';
import { getLang, t } from './i18n.js';
import { shopNow, weekdayOf } from './shopTime.js';
import { validateName, isSpam } from './validation.js';
import { buildBookingMessage, waLink } from './whatsapp.js';
import { $, fieldError, clearFieldError } from './ui.js';

/** Populate the service <select> and date/time bounds for the active language. */
export function initBookingForm() {
  const sel = $('#wbService');
  const dateInput = $('#wbDate');
  if (!sel || !dateInput) return;

  const render = () => {
    const lang = getLang();
    sel.innerHTML = SHOP.services
      .map((s) => `<option value="${s.id}">${t(`services.names.${s.id}`)} — ${t('services.price', { price: s.price })} · ${t('services.min', { n: s.duration })}</option>`)
      .join('');
    const now = shopNow();
    dateInput.min = now.date;
    const [y, m, d] = now.date.split('-').map(Number);
    const max = new Date(Date.UTC(y, m - 1, d + SHOP.maxAdvanceDays));
    dateInput.max = max.toISOString().slice(0, 10);
    // default: next open day, 10:00
    let probe = now.date;
    for (let i = 0; i < 7 && !SHOP.hours[weekdayOf(probe)]; i += 1) {
      const [yy, mm, dd] = probe.split('-').map(Number);
      probe = new Date(Date.UTC(yy, mm - 1, dd + 1)).toISOString().slice(0, 10);
    }
    dateInput.value = probe;
    $('#wbTime').value = '10:00';
  };
  render();
  document.addEventListener('sb:langchange', render);

  $('#whatsappForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#wbName');
    const date = $('#wbDate');
    const time = $('#wbTime');
    const err = $('#wbError');
    clearFieldError(name, err);

    // Honeypot: silently "succeed" for bots (no WhatsApp open).
    if (isSpam($('#wbCompany').value)) return;

    let msgKey = null;
    if (!sel.value) msgKey = 'service';
    else if (!validateName(name.value)) msgKey = 'name';
    else if (!date.value) msgKey = 'date';
    else if (date.value < date.min) msgKey = 'datePast';
    else if (!SHOP.hours[weekdayOf(date.value)]) msgKey = 'dateClosed';
    else if (!time.value) msgKey = 'time';

    if (msgKey) {
      fieldError(msgKey === 'name' ? name : date, err, t(`booking.errors.${msgKey}`));
      (msgKey === 'name' ? name : date).focus();
      return;
    }

    const message = buildBookingMessage(getLang(), {
      serviceName: t(`services.names.${sel.value}`),
      dateStr: date.value,
      time: time.value,
      name: name.value,
    });
    window.open(waLink(message), '_blank', 'noopener');
  });
}
