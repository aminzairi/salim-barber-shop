/* =============================================================================
 * PHASE 2 — MANAGE BOOKING (find by reference → cancel or reschedule).
 * Mounted with the wizard (see main.js). Policy: free change up to
 * SHOP.cancellationWindowHours hours before the appointment start.
 * ========================================================================== */
import { SHOP } from './config.js';
import { getLang, t, formatDate, formatTime } from './i18n.js';
import { shopNow, addDays, weekdayOf } from './shopTime.js';
import { availabilityFor } from './slots.js';
import { getBookingByRef, cancelBooking, rescheduleBooking, getBusyForDate, canCancel, ApiError } from './api.js';
import { $, escapeHtml } from './ui.js';

let found = null;

export function mountManage() {
  const mount = document.getElementById('manageMount');
  if (!mount) return;
  mount.hidden = false;
  renderForm();
  document.addEventListener('sb:langchange', () => { if (found) renderFound(); else renderForm(); });
}

function renderForm() {
  const mount = document.getElementById('manageMount');
  mount.innerHTML = `
    <div class="card booking-card" style="margin-block-start:1.4rem">
      <h3>${escapeHtml(t('manage.title'))}</h3>
      <p class="booking-intro">${escapeHtml(t('manage.intro'))}</p>
      <form id="manageForm" novalidate style="display:flex;gap:.7rem;flex-wrap:wrap;align-items:end">
        <div class="field" style="flex:1;min-width:220px">
          <label for="mgRef">${escapeHtml(t('manage.refLabel'))}</label>
          <input type="text" id="mgRef" autocomplete="off" style="text-transform:uppercase" />
        </div>
        <button type="submit" class="btn btn-outline">${escapeHtml(t('manage.find'))}</button>
      </form>
      <p class="form-error" id="mgErr" role="alert" hidden></p>
      <div id="mgResult"></div>
    </div>`;
  $('#manageForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#mgErr');
    err.hidden = true;
    try {
      found = await getBookingByRef($('#mgRef').value);
      if (!found || found.status === 'cancelled' || found.status === 'blocked') {
        found = null;
        throw new ApiError(t('manage.notFound'), 'NOT_FOUND', 404);
      }
      renderFound();
    } catch (ex) {
      err.textContent = ex.code === 'NOT_FOUND' ? ex.message : t('manage.notFound');
      err.hidden = false;
    }
  });
}

function bGet(b, k) { return b[k] ?? b[{ serviceId: 'service_id', barberId: 'barber_id', date: 'booking_date', start: 'start_time' }[k]]; }

function renderFound() {
  const box = $('#mgResult');
  const lang = getLang();
  const b = found;
  const service = SHOP.services.find((s) => s.id === bGet(b, 'serviceId'));
  const cancellable = canCancel(b);
  box.innerHTML = `
    <div style="border-block-start:1px dashed var(--border);margin-block-start:1rem;padding-block-start:1rem">
      <h4>${escapeHtml(t('manage.yourBooking'))}</h4>
      <ul class="review-list">
        <li><span>${escapeHtml(t('wizard.reviewService'))}</span><b>${escapeHtml(t(`services.names.${bGet(b, 'serviceId')}`))}</b></li>
        <li><span>${escapeHtml(t('wizard.reviewBarber'))}</span><b>${escapeHtml(t(`barbers.names.${bGet(b, 'barberId')}`))}</b></li>
        <li><span>${escapeHtml(t('wizard.reviewWhen'))}</span><b>${escapeHtml(formatDate(bGet(b, 'date'), lang))} · ${formatTime(bGet(b, 'start'), lang)}</b></li>
        <li><span>${escapeHtml(t('confirmation.ref'))}</span><b>${escapeHtml(b.ref)}</b></li>
      </ul>
      <div style="display:flex;gap:.7rem;flex-wrap:wrap">
        <button type="button" class="btn btn-outline" id="mgCancel" ${cancellable ? '' : 'title="' + escapeHtml(t('manage.cancelDenied', { hours: SHOP.cancellationWindowHours })) + '"'}>
          ${escapeHtml(t('manage.cancel'))}</button>
        <button type="button" class="btn btn-outline" id="mgResched" ${cancellable ? '' : 'disabled'}>
          ${escapeHtml(t('manage.reschedule'))}</button>
      </div>
      <div id="mgReschedBox" style="margin-block-start:1rem"></div>
      <p class="form-error" id="mgErr2" role="alert" hidden></p>
      ${!cancellable ? `<p class="policy-note">${escapeHtml(t('manage.cancelDenied', { hours: SHOP.cancellationWindowHours }))}</p>` : ''}
    </div>`;

  $('#mgCancel').addEventListener('click', async () => {
    if (!window.confirm(t('manage.cancelConfirm'))) return;
    try {
      await cancelBooking(b.ref);
      found = null;
      box.innerHTML = `<p><b>${escapeHtml(t('manage.cancelled'))}</b></p>`;
    } catch { $('#mgErr2').textContent = t('wizard.errors.generic'); $('#mgErr2').hidden = false; }
  });

  $('#mgResched')?.addEventListener('click', () => renderReschedule());
}

function renderReschedule() {
  const boxEl = $('#mgReschedBox');
  const now = shopNow();
  const days = Array.from({ length: SHOP.maxAdvanceDays }, (_, i) => addDays(now.date, i))
    .filter((d) => SHOP.hours[weekdayOf(d)]);
  boxEl.innerHTML = `
    <div class="form-row">
      <div class="field">
        <label for="mgNewDate">${escapeHtml(t('manage.newDate'))}</label>
        <select id="mgNewDate">${days.map((d) =>
          `<option value="${d}">${escapeHtml(formatDate(d, getLang()))}</option>`).join('')}</select>
      </div>
      <div class="field">
        <label for="mgNewTime">${escapeHtml(t('manage.newTime'))}</label>
        <select id="mgNewTime"></select>
      </div>
    </div>
    <button type="button" class="btn btn-primary" id="mgMove">${escapeHtml(t('manage.reschedule'))}</button>`;

  const loadTimes = async () => {
    const dateSel = $('#mgNewDate');
    const timeSel = $('#mgNewTime');
    timeSel.innerHTML = `<option>…</option>`;
    let busy = [];
    try { busy = await getBusyForDate(dateSel.value); } catch { /* ignore */ }
    // exclude own current booking from the conflict set
    busy = busy.filter((x) => !(x.start === bGet(found, 'start') && x.barberId === bGet(found, 'barberId')));
    const { slots } = availabilityFor(SHOP, dateSel.value, busy, {
      serviceId: bGet(found, 'serviceId'), barberId: bGet(found, 'barberId'), now,
    });
    timeSel.innerHTML = slots.length
      ? slots.map((s) => `<option value="${s}">${s}</option>`).join('')
      : `<option value="">${escapeHtml(t('wizard.noSlots'))}</option>`;
  };
  $('#mgNewDate').addEventListener('change', loadTimes);
  loadTimes();

  $('#mgMove').addEventListener('click', async () => {
    try {
      const moved = await rescheduleBooking(found.ref, $('#mgNewDate').value, $('#mgNewTime').value, bGet(found, 'barberId'));
      if (!moved || (!moved.ref && !moved.ok)) throw new Error('taken');
      found = null;
      $('#mgResult').innerHTML = `<p><b>${escapeHtml(t('manage.rescheduleOk'))}</b></p>`;
    } catch (e) {
      const err = $('#mgErr2');
      err.textContent = e.code === 'SLOT_TAKEN' || e.status === 409 ? t('manage.slotTaken') : t('wizard.errors.generic');
      err.hidden = false;
    }
  });
}
