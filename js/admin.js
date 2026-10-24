/* =============================================================================
 * PHASE 2 — ADMIN PANEL (password-protected).
 * Production: Supabase Auth (email/password); RLS authorizes admin reads and
 * the cancel/block/walk-in RPCs server-side. Demo mode: DEMO-ONLY credentials
 * in js/api.js (marked) — never rely on them in production.
 * ========================================================================== */
import { SHOP } from './config.js';
import { initLanguage, setLanguage, getLang, t, formatDate, formatTime } from './i18n.js';
import { shopNow } from './shopTime.js';
import {
  adminSignIn, adminSignOut, isAdminSignedIn,
  adminListBookings, adminCancel, adminBlockSlot, adminUpdateWalkIn,
} from './api.js';
import { $, $$, escapeHtml, toast } from './ui.js';

initLanguage();
$$('.lang-btn').forEach((b) => b.addEventListener('click', () => setLanguage(b.dataset.lang)));
document.addEventListener('sb:langchange', () => { refreshLang(); loadDashboard(); });
function refreshLang() {
  $$('.lang-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === getLang())));
  $('#brandName').textContent = getLang() === 'ar' ? SHOP.nameAr : SHOP.name;
}
refreshLang();
$('#logoutBtn').hidden = !isAdminSignedIn();

/* ---------- login ---------- */
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#adErr');
  err.hidden = true;
  try {
    await adminSignIn($('#adEmail').value.trim(), $('#adPass').value);
    showDashboard();
  } catch {
    err.textContent = t('admin.wrongCredentials');
    err.hidden = false;
  }
});
$('#logoutBtn').addEventListener('click', () => { adminSignOut(); location.reload(); });

if (isAdminSignedIn()) showDashboard();

function showDashboard() {
  $('#loginCard').hidden = true;
  $('#dashboard').hidden = false;
  $('#logoutBtn').hidden = false;
  const now = shopNow();
  $('#blDate').min = now.date;
  $('#blDate').value = now.date;
  $('#blBarber').innerHTML = SHOP.barbers.map((b) =>
    `<option value="${b.id}">${escapeHtml(t(`barbers.names.${b.id}`))}</option>`).join('');
  loadDashboard();
}

/* ---------- bookings table ---------- */
async function loadDashboard() {
  if ($('#dashboard').hidden) return;
  const tbody = $('#bookingsTable tbody');
  const now = shopNow();
  let rows = [];
  try { rows = await adminListBookings(now.date); } catch { rows = []; }
  $('#noBookings').hidden = rows.length > 0;
  const lang = getLang();
  tbody.innerHTML = rows.map((b) => {
    const serviceId = b.serviceId ?? b.service_id;
    const barberId = b.barberId ?? b.barber_id;
    const date = b.date ?? b.booking_date;
    const start = b.start ?? b.start_time;
    const status = b.status ?? 'booked';
    const name = serviceId ? t(`services.names.${serviceId}`) : (b.note || b.name || '—');
    return `<tr>
      <td><b>${escapeHtml(b.ref)}</b></td>
      <td>${escapeHtml(formatDate(date, lang, { weekday: 'short' }))}</td>
      <td dir="ltr">${escapeHtml(start)}</td>
      <td>${escapeHtml(b.name || '')}</td>
      <td dir="ltr">${escapeHtml(b.phone || '')}</td>
      <td>${escapeHtml(name)}</td>
      <td>${barberId ? escapeHtml(t(`barbers.names.${barberId}`)) : '—'}</td>
      <td><span class="badge ${status}">${escapeHtml(t(`admin.statuses.${status}`))}</span></td>
      <td>${status === 'booked'
        ? `<button type="button" class="btn btn-outline btn-sm" data-cancel="${escapeHtml(b.ref)}">${escapeHtml(t('admin.cancel'))}</button>`
        : ''}</td>
    </tr>`;
  }).join('');
  tbody.querySelectorAll('[data-cancel]').forEach((btn) => btn.addEventListener('click', async () => {
    await adminCancel(btn.dataset.cancel);
    toast(btn.dataset.cancel);
    loadDashboard();
  }));
}

/* ---------- block slot ---------- */
$('#blockForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  await adminBlockSlot({
    date: $('#blDate').value,
    start: $('#blStart').value || '09:00',
    barberId: $('#blBarber').value,
    durationMin: Number($('#blDur').value) || 30,
    reason: $('#blReason').value,
  });
  toast(t('admin.blockOk'));
  loadDashboard();
});

/* ---------- walk-in status ---------- */
$('#walkinForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  await adminUpdateWalkIn(Number($('#wiWaiting').value) || 0, Number($('#wiEta').value) || 0);
  toast(t('admin.walkinOk'));
});
