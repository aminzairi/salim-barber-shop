/* =============================================================================
 * PHASE 2 — BOOKING WIZARD (4 steps, progress indicator, no double-booking).
 * Mounted only when a backend is configured (see main.js). Phase 1's WhatsApp
 * form stays below as an alternative channel.
 * State machine: step 1 service+barber → 2 date+time → 3 details → 4 review.
 * ========================================================================== */
import { SHOP } from './config.js';
import { getLang, t, formatDate, formatTime } from './i18n.js';
import { shopNow, addDays, weekdayOf } from './shopTime.js';
import { availabilityFor } from './slots.js';
import { validateName, normalizePhone, validateEmail, sanitizeNote, isSpam, validateBookingDate } from './validation.js';
import { createBooking, getBusyForDate, MODE, ApiError } from './api.js';
import { buildConfirmMessage, waLink } from './whatsapp.js';
import { downloadIcs } from './ics.js';
import { $, escapeHtml, toast } from './ui.js';

const state = {
  step: 1,
  serviceId: null,
  barberId: 'any',
  date: null,
  time: null,
  name: '', phone: '', email: '', note: '',
  result: null, // confirmed booking
};

export function mountWizard() {
  const mount = document.getElementById('wizardMount');
  if (!mount) return;
  mount.hidden = false;
  render();
  document.addEventListener('sb:langchange', () => { if (!state.result) render(); });
}

/* ---------- rendering ---------- */
function render() {
  const mount = document.getElementById('wizardMount');
  const lang = getLang();
  const steps = t('wizard.steps') || [];
  mount.innerHTML = `
    <div class="wizard" id="wizardRoot">
      <ol class="wizard-progress" aria-label="${escapeHtml(t('wizard.title'))}">
        ${steps.map((label, i) => `
          <li class="${i + 1 === state.step ? 'current' : ''} ${i + 1 < state.step ? 'done' : ''}"
              aria-current="${i + 1 === state.step ? 'step' : 'false'}">${escapeHtml(label)}</li>`).join('')}
      </ol>
      <div class="card" id="wizardPanel"></div>
      ${MODE === 'local' ? `<p class="demo-note">${escapeHtml(t('misc.demoMode'))}</p>` : ''}
    </div>`;
  const panel = $('#wizardPanel', mount);
  if (state.result) renderConfirmation(panel, lang);
  else if (state.step === 1) renderStep1(panel);
  else if (state.step === 2) renderStep2(panel, lang);
  else if (state.step === 3) renderStep3(panel);
  else renderStep4(panel, lang);
}

/* ---------- Step 1: service (+ barber) ---------- */
function renderStep1(panel) {
  panel.innerHTML = `
    <h3 class="wizard-step-title">${escapeHtml(t('wizard.chooseService'))}</h3>
    <div class="choice-grid" role="group">
      ${SHOP.services.map((s) => `
        <button type="button" class="choice-btn" data-service="${s.id}" aria-pressed="${state.serviceId === s.id}">
          <span>${escapeHtml(t(`services.names.${s.id}`))}</span>
          <span class="choice-meta">${t('services.price', { price: s.price })} · ${t('services.min', { n: s.duration })}</span>
        </button>`).join('')}
    </div>
    ${SHOP.barberChoice ? `
      <h3 class="wizard-step-title" style="margin-block-start:1.4rem">${escapeHtml(t('wizard.chooseBarber'))}</h3>
      <div class="choice-grid" role="group">
        <button type="button" class="choice-btn" data-barber="any" aria-pressed="${state.barberId === 'any'}">
          <span>${escapeHtml(t('wizard.anyBarber'))}</span>
        </button>
        ${SHOP.barbers.map((b) => `
          <button type="button" class="choice-btn" data-barber="${b.id}" aria-pressed="${state.barberId === b.id}">
            <span>${escapeHtml(t(`barbers.names.${b.id}`))}</span>
            <span class="choice-meta">${escapeHtml(t(`barbers.specialties.${b.id}`))}</span>
          </button>`).join('')}
      </div>` : ''}
    <div class="wizard-nav">
      <span></span>
      <button type="button" class="btn btn-primary" id="wzNext" ${state.serviceId ? '' : 'disabled'}>${escapeHtml(t('wizard.next'))}</button>
    </div>`;

  panel.querySelectorAll('[data-service]').forEach((btn) => btn.addEventListener('click', () => {
    state.serviceId = btn.dataset.service;
    panel.querySelectorAll('[data-service]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    $('#wzNext').disabled = false;
  }));
  panel.querySelectorAll('[data-barber]').forEach((btn) => btn.addEventListener('click', () => {
    state.barberId = btn.dataset.barber;
    panel.querySelectorAll('[data-barber]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  }));
  $('#wzNext').addEventListener('click', () => { state.step = 2; render(); });
}

/* ---------- Step 2: date + time ---------- */
async function renderStep2(panel, lang) {
  const now = shopNow();
  const days = Array.from({ length: SHOP.maxAdvanceDays }, (_, i) => addDays(now.date, i));
  panel.innerHTML = `
    <h3 class="wizard-step-title">${escapeHtml(t('wizard.chooseDate'))}</h3>
    <div class="date-strip" role="group">
      ${days.map((d) => {
        const closed = !SHOP.hours[weekdayOf(d)];
        return `<button type="button" class="date-chip" data-date="${d}" ${closed ? 'disabled' : ''}
                 aria-pressed="${state.date === d}">
                  <span class="dow">${escapeHtml(shortDow(d, lang))}</span>${shortDate(d, lang)}
                </button>`;
      }).join('')}
    </div>
    <h3 class="wizard-step-title" style="margin-block-start:1.2rem">${escapeHtml(t('wizard.chooseTime'))}</h3>
    <p id="wzSlotsMsg" class="policy-note">${escapeHtml(t('wizard.loadingSlots'))}</p>
    <div class="slot-grid" id="wzSlots" role="group" aria-live="polite"></div>
    <div class="wizard-nav">
      <button type="button" class="btn btn-outline" id="wzBack">${escapeHtml(t('wizard.back'))}</button>
      <button type="button" class="btn btn-primary" id="wzNext" ${state.time ? '' : 'disabled'}>${escapeHtml(t('wizard.next'))}</button>
    </div>`;

  $('#wzBack').addEventListener('click', () => { state.step = 1; render(); });
  const chips = panel.querySelectorAll('[data-date]');
  chips.forEach((chip) => chip.addEventListener('click', () => {
    state.date = chip.dataset.date;
    state.time = null;
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
    loadSlots();
  }));
  if (!state.date) {
    const firstOpen = days.find((d) => SHOP.hours[weekdayOf(d)]);
    state.date = firstOpen;
    panel.querySelector(`[data-date="${firstOpen}"]`)?.setAttribute('aria-pressed', 'true');
  } else {
    panel.querySelector(`[data-date="${state.date}"]`)?.setAttribute('aria-pressed', 'true');
  }
  await loadSlots();
  $('#wzNext').addEventListener('click', () => { state.step = 3; render(); });

  async function loadSlots() {
    const msg = $('#wzSlotsMsg');
    const grid = $('#wzSlots');
    msg.hidden = false;
    msg.textContent = t('wizard.loadingSlots');
    grid.innerHTML = '';
    let busy = [];
    try { busy = await getBusyForDate(state.date); } catch { /* offline → empty grid */ }
    const { slots } = availabilityFor(SHOP, state.date, busy, {
      serviceId: state.serviceId, barberId: state.barberId, now: shopNow(),
    });
    msg.textContent = slots.length === 0 ? t('wizard.noSlots') : '';
    msg.hidden = slots.length > 0;
    grid.innerHTML = slots.map((s) => `
      <button type="button" class="slot-btn" data-slot="${s}" aria-pressed="${state.time === s}">${s}</button>`).join('');
    grid.querySelectorAll('[data-slot]').forEach((b) => b.addEventListener('click', () => {
      state.time = b.dataset.slot;
      grid.querySelectorAll('[data-slot]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      $('#wzNext').disabled = false;
    }));
    $('#wzNext').disabled = !state.time;
  }
}

function shortDow(dateStr, lang) {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-TN' : lang, { weekday: 'short', timeZone: 'UTC' })
    .format(new Date(`${dateStr}T00:00:00Z`));
}
function shortDate(dateStr, lang) {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-TN' : lang, { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${dateStr}T00:00:00Z`));
}

/* ---------- Step 3: details ---------- */
function renderStep3(panel) {
  panel.innerHTML = `
    <h3 class="wizard-step-title">${escapeHtml(t('wizard.fullName'))}</h3>
    <form id="wzForm" novalidate>
      <div class="field" style="margin-block-end:1rem">
        <label for="wzName">${escapeHtml(t('wizard.fullName'))}</label>
        <input type="text" id="wzName" autocomplete="name" maxlength="80" value="${escapeHtml(state.name)}" required />
      </div>
      <div class="field" style="margin-block-end:1rem">
        <label for="wzPhone">${escapeHtml(t('wizard.phone'))}</label>
        <input type="tel" id="wzPhone" autocomplete="tel" inputmode="tel" placeholder="22 123 456" value="${escapeHtml(state.phone)}" required />
        <p class="field-hint">${escapeHtml(t('wizard.phoneHint'))}</p>
      </div>
      <div class="field" style="margin-block-end:1rem">
        <label for="wzEmail">${escapeHtml(t('wizard.email'))}</label>
        <input type="email" id="wzEmail" autocomplete="email" value="${escapeHtml(state.email)}" />
      </div>
      <div class="field" style="margin-block-end:1rem">
        <label for="wzNote">${escapeHtml(t('wizard.note'))}</label>
        <textarea id="wzNote" rows="2" maxlength="500" placeholder="${escapeHtml(t('wizard.notePlaceholder'))}">${escapeHtml(state.note)}</textarea>
      </div>
      <div class="hp-field" aria-hidden="true"><label for="wzHp">Fax</label><input type="text" id="wzHp" tabindex="-1" autocomplete="off" /></div>
      <p class="form-error" id="wzErr" role="alert" hidden></p>
      <div class="wizard-nav">
        <button type="button" class="btn btn-outline" id="wzBack">${escapeHtml(t('wizard.back'))}</button>
        <button type="submit" class="btn btn-primary">${escapeHtml(t('wizard.next'))}</button>
      </div>
    </form>`;

  $('#wzBack').addEventListener('click', () => { state.step = 2; render(); });
  $('#wzForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const err = $('#wzErr');
    err.hidden = true;
    const name = $('#wzName').value;
    const phone = $('#wzPhone').value;
    const email = $('#wzEmail').value;
    let key = null;
    if (isSpam($('#wzHp').value)) return; // bot: silently stop
    if (!validateName(name)) key = 'name';
    else if (!normalizePhone(phone)) key = 'phone';
    else if (email && !validateEmail(email)) key = 'email';
    if (key) {
      err.textContent = t(`wizard.errors.${key}`);
      err.hidden = false;
      $(key === 'name' ? '#wzName' : key === 'phone' ? '#wzPhone' : '#wzEmail').focus();
      return;
    }
    Object.assign(state, {
      name: name.trim(), phone: normalizePhone(phone), email: email.trim(), note: sanitizeNote($('#wzNote').value),
    });
    state.step = 4;
    render();
  });
}

/* ---------- Step 4: review + confirm ---------- */
function renderStep4(panel, lang) {
  const service = SHOP.services.find((s) => s.id === state.serviceId);
  panel.innerHTML = `
    <h3 class="wizard-step-title">${escapeHtml(t('wizard.review'))}</h3>
    <ul class="review-list">
      <li><span>${escapeHtml(t('wizard.reviewService'))}</span><b>${escapeHtml(t(`services.names.${state.serviceId}`))}</b></li>
      ${SHOP.barberChoice ? `<li><span>${escapeHtml(t('wizard.reviewBarber'))}</span><b>${escapeHtml(state.barberId === 'any' ? t('wizard.anyBarber') : t(`barbers.names.${state.barberId}`))}</b></li>` : ''}
      <li><span>${escapeHtml(t('wizard.reviewWhen'))}</span><b>${escapeHtml(formatDate(state.date, lang))} · ${formatTime(state.time, lang)}</b></li>
      <li><span>${escapeHtml(t('wizard.reviewDuration'))}</span><b>${t('services.min', { n: service.duration })}</b></li>
      <li><span>${escapeHtml(t('wizard.reviewPrice'))}</span><b>${t('services.price', { price: service.price })}</b></li>
      <li><span>${escapeHtml(t('wizard.fullName'))}</span><b>${escapeHtml(state.name)}</b></li>
      <li><span>${escapeHtml(t('wizard.phone'))}</span><b dir="ltr">${escapeHtml(state.phone)}</b></li>
    </ul>
    <p class="policy-note">${escapeHtml(t('wizard.policy', { hours: SHOP.cancellationWindowHours }))}</p>
    <p class="form-error" id="wzErr" role="alert" hidden></p>
    <div class="wizard-nav">
      <button type="button" class="btn btn-outline" id="wzBack">${escapeHtml(t('wizard.back'))}</button>
      <button type="button" class="btn btn-primary" id="wzConfirm">${escapeHtml(t('wizard.confirm'))}</button>
    </div>`;

  $('#wzBack').addEventListener('click', () => { state.step = 3; render(); });
  $('#wzConfirm').addEventListener('click', confirm);

  async function confirm() {
    const btn = $('#wzConfirm');
    const err = $('#wzErr');
    btn.disabled = true;
    btn.textContent = t('wizard.sending');
    err.hidden = true;
    try {
      const dateErr = validateBookingDate(state.date, SHOP, shopNow());
      if (dateErr) throw new ApiError('date', dateErr, 400);
      state.result = await createBooking({
        serviceId: state.serviceId, barberId: state.barberId, date: state.date,
        start: state.time, name: state.name, phone: state.phone, email: state.email,
        note: state.note, lang: getLang(),
      });
      render();
      document.getElementById('wizardRoot').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      btn.disabled = false;
      btn.textContent = t('wizard.confirm');
      if (e instanceof ApiError && (e.code === 'SLOT_TAKEN' || e.status === 409)) {
        err.textContent = t('wizard.errors.taken');
        state.step = 2;
        setTimeout(render, 1800); // back to time selection
      } else {
        err.textContent = t('wizard.errors.generic');
        err.hidden = false;
      }
    }
  }
}

/* ---------- Confirmation screen ---------- */
function renderConfirmation(panel, lang) {
  const b = state.result; // {ref, serviceId, barberId, date, start, ...} (normalized shape)
  const service = SHOP.services.find((s) => s.id === b.serviceId);
  const serviceName = t(`services.names.${b.serviceId}`);
  const barberName = b.barberId && t(`barbers.names.${b.barberId}`);
  panel.innerHTML = `
    <div class="confirm-box">
      <p class="big-check" aria-hidden="true">✅</p>
      <h3 class="wizard-step-title">${escapeHtml(t('confirmation.title'))}</h3>
      <p>${escapeHtml(t('confirmation.subtitle'))}</p>
      <p><b>${escapeHtml(serviceName)}</b>${barberName ? ` — ${escapeHtml(barberName)}` : ''}<br/>
         ${escapeHtml(formatDate(b.date, lang))} · ${formatTime(b.start, lang)}</p>
      <div class="ref-pill">
        <span>${escapeHtml(t('confirmation.ref'))}: <b>${escapeHtml(b.ref)}</b></span>
        <button type="button" class="link-btn" id="wzCopy">${escapeHtml(t('confirmation.copy'))}</button>
      </div>
      <div class="confirm-actions">
        <button type="button" class="btn btn-outline" id="wzIcs">📅 ${escapeHtml(t('confirmation.addToCalendar'))}</button>
        <a class="btn btn-whatsapp" id="wzWa" target="_blank" rel="noopener">💬 ${escapeHtml(t('confirmation.whatsappConfirm'))}</a>
        <a class="btn btn-outline" href="${SHOP.googleReviewsUrl}" target="_blank" rel="noopener">⭐ ${escapeHtml(t('confirmation.review'))}</a>
      </div>
      ${MODE === 'local' ? `<p class="demo-note" style="margin-block-start:1.2rem">${escapeHtml(t('confirmation.demo'))}</p>` : ''}
    </div>`;

  $('#wzIcs').addEventListener('click', () => downloadIcs({
    ref: b.ref,
    title: `${serviceName} — ${SHOP.name}`,
    dateStr: b.date,
    time: b.start,
    durationMin: service.duration,
    description: `${t('confirmation.ref')}: ${b.ref}`,
  }));
  $('#wzWa').href = waLink(buildConfirmMessage(lang, {
    ref: b.ref, serviceName, dateStr: b.date, time: b.start,
  }));
  $('#wzCopy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(b.ref);
      $('#wzCopy').textContent = t('confirmation.copied');
      toast(b.ref);
    } catch { /* clipboard blocked — ref is visible anyway */ }
  });
}
