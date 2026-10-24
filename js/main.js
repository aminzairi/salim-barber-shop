/* =============================================================================
 * PAGE ORCHESTRATOR — wires every static section, then loads Phase 2 modules
 * when a backend is configured (progressive enhancement, no Phase 1 rewrite).
 * ========================================================================== */
import { SHOP } from './config.js';
import { initLanguage, setLanguage, getLang, t, formatTime, SUPPORTED } from './i18n.js';
import { shopNow } from './shopTime.js';
import { getWalkInStatus, MODE } from './api.js';
import { initBookingForm } from './booking.js';
import { $, $$, escapeHtml } from './ui.js';

/* ---------- language init (?lang= wins, then saved, then browser) ---------- */
const urlLang = new URLSearchParams(location.search).get('lang');
initLanguage();
if (urlLang && SUPPORTED.includes(urlLang) && urlLang !== getLang()) setLanguage(urlLang);

/* ---------- header: switcher, mobile nav ---------- */
function refreshLangButtons() {
  $$('.lang-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === getLang())));
}
refreshLangButtons();
$$('.lang-btn').forEach((b) => b.addEventListener('click', () => setLanguage(b.dataset.lang)));

const header = $('.site-header');
const navToggle = $('#navToggle');
navToggle?.addEventListener('click', () => {
  const open = header.classList.toggle('nav-open');
  navToggle.setAttribute('aria-expanded', String(open));
});
$$('.main-nav a').forEach((a) => a.addEventListener('click', () => {
  header.classList.remove('nav-open');
  navToggle.setAttribute('aria-expanded', 'false');
}));

/* ---------- dynamic sections (re-rendered on language change) ---------- */
function renderServices() {
  $('#servicesList').innerHTML = SHOP.services.map((s) => `
    <li class="card service-card">
      <h3 class="service-name">${t(`services.names.${s.id}`)}</h3>
      <p class="service-meta">${t('services.min', { n: s.duration })}</p>
      <p class="service-price">${t('services.price', { price: s.price })}</p>
      <button type="button" class="btn btn-outline btn-sm" data-book-service="${s.id}">${t('services.book')}</button>
    </li>`).join('');
  $$('#servicesList [data-book-service]').forEach((btn) => btn.addEventListener('click', () => {
    const sel = $('#wbService');
    if (sel) sel.value = btn.dataset.bookService;
    document.getElementById('booking').scrollIntoView();
    setTimeout(() => $('#wbName')?.focus(), 350);
  }));
}

function renderBarbers() {
  if (!SHOP.barberChoice) { document.getElementById('barbers')?.remove(); return; }
  $('#barbersList').innerHTML = SHOP.barbers.map((b) => `
    <li class="card barber-card">
      <img class="barber-photo" src="${b.photo}" alt="" width="110" height="110" loading="lazy" />
      <h3 class="barber-name">${t(`barbers.names.${b.id}`)}</h3>
      <p class="barber-spec">${t('barbers.specialties.' + b.id)}</p>
    </li>`).join('');
}

function renderFaq() {
  const items = t('faq.items') || [];
  $('#faqList').innerHTML = items.map((item, i) => `
    <details class="faq-item" ${i === 0 ? 'open' : ''}>
      <summary>${escapeHtml(item.q)}</summary>
      <p>${escapeHtml(item.a)}</p>
    </details>`).join('');
}

function renderHoursTable() {
  const now = shopNow();
  const rows = SHOP.hours.map((h, i) => {
    const label = t(`contact.days.${i}`);
    const val = h ? `${formatTime(h.open, getLang())} – ${formatTime(h.close, getLang())}` : t('contact.closed');
    return `<tr class="${i === now.weekday ? 'today' : ''}">
      <td>${label}</td><td class="${h ? '' : 'closed'}">${val}</td></tr>`;
  }).join('');
  $('#hoursTable tbody').innerHTML = rows;
}

function renderBrand() {
  const name = getLang() === 'ar' ? SHOP.nameAr : SHOP.name;
  $('#brandName').textContent = name;
  $('#footerBrand').textContent = name;
  $('#shopAddress').textContent = SHOP.address;
}

/* ---------- hero: today's hours + open/closed badge ---------- */
function renderHeroStatus() {
  const now = shopNow();
  const badge = $('#openStatusBadge');
  const todayEl = $('#todayHours');
  const h = SHOP.hours[now.weekday];
  if (!h) {
    badge.className = 'status-badge is-closed';
    badge.textContent = t('hero.closedToday');
    todayEl.textContent = '';
    return;
  }
  const open = shopMinutes(now.time) >= toMin(h.open) && shopMinutes(now.time) < toMin(h.close);
  badge.className = `status-badge ${open ? 'is-open' : 'is-closed'}`;
  badge.textContent = open ? t('hero.openNow') : t('hero.closedNow');
  todayEl.textContent = t('hero.today', { hours: `${formatTime(h.open, getLang())} – ${formatTime(h.close, getLang())}` });
}
const toMin = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const shopMinutes = toMin; // alias: now.time is also HH:MM

/* ---------- walk-in status (live-ish: refreshed every 5 min) ---------- */
async function renderWalkIn() {
  const s = await getWalkInStatus();
  const el = $('#walkinStatus');
  if (!el) return;
  el.textContent = s.waiting > 0
    ? `${t('walkin.waiting', { count: s.waiting })} · ${t('walkin.eta', { minutes: s.etaMinutes })}`
    : t('walkin.noQueue');
  const upd = $('#walkinUpdated');
  if (upd && s.updatedAt) {
    const time = new Intl.DateTimeFormat(getLang() === 'ar' ? 'ar-TN' : getLang(), { hour: '2-digit', minute: '2-digit' }).format(new Date(s.updatedAt));
    upd.textContent = t('walkin.updated', { time });
  }
}

/* ---------- contact links ---------- */
function renderContactLinks() {
  $('#waBtn').href = `https://wa.me/${SHOP.whatsapp}`;
  $('#waContactLink').href = `https://wa.me/${SHOP.whatsapp}`;
  $('#mapBtn').href = SHOP.mapUrl;
}

/* ---------- privacy dialog ---------- */
$('#privacyOpen')?.addEventListener('click', () => $('#privacyDialog').showModal());
$('#privacyClose')?.addEventListener('click', () => $('#privacyDialog').close());

/* ---------- one re-render to rule them all (Observer on language) ---------- */
function renderAll() {
  renderBrand();
  renderServices();
  renderBarbers();
  renderFaq();
  renderHoursTable();
  renderHeroStatus();
  renderContactLinks();
  refreshLangButtons();
}
renderAll();
document.addEventListener('sb:langchange', renderAll);
$('#year').textContent = String(new Date().getFullYear());

/* ---------- Phase 1 init ---------- */
initBookingForm();
renderWalkIn();
setInterval(renderWalkIn, 5 * 60 * 1000);

/* ---------- Phase 2 progressive enhancement ---------- */
if (MODE === 'supabase') {
  import('./wizard.js').then((m) => m.mountWizard());
  import('./manage.js').then((m) => m.mountManage());
} else if (location.hash === '#demo-wizard') {
  // Demo of the Phase 2 wizard without a backend (localStorage) — also used by e2e tests.
  import('./wizard.js').then((m) => m.mountWizard());
  import('./manage.js').then((m) => m.mountManage());
}

/* ---------- PWA service worker ---------- */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => { /* offline-first is best-effort */ }));
}
