/* =============================================================================
 * API / DATA ACCESS LAYER (Repository pattern).
 *
 * Two backends behind one interface:
 *  - 'supabase' : Phase 2 production. Talks to Supabase REST + RPC with the
 *                 ANON key only. Double-booking is prevented server-side by
 *                 create_booking() (unique index + explicit lock) — see
 *                 backend/supabase/schema.sql.
 *  - 'local'    : Phase 1 / demo fallback. localStorage. Conflict check is
 *                 client-side only — CLEARLY NOT FOR PRODUCTION.
 *
 * === TO GO LIVE ===
 * Fill backend.supabaseUrl / supabaseAnonKey in js/config.js, run
 * backend/supabase/schema.sql in the Supabase SQL editor. Nothing else changes.
 * ========================================================================== */
import { SHOP } from './config.js';
import { shopNow, toMin, fromMin, shopToUtcMs } from './shopTime.js';
import { pickBarber } from './slots.js';

const LS_BOOKINGS = 'sb_bookings';
const LS_WALKIN = 'sb_walkin';

const backendOn = Boolean(SHOP.backend.supabaseUrl && SHOP.backend.supabaseAnonKey);
export const MODE = backendOn ? 'supabase' : 'local';

/* ---------- tiny Supabase REST client (fetch, zero dependencies) ---------- */
const sbUrl = SHOP.backend.supabaseUrl.replace(/\/$/, '');
const sbHeaders = () => ({
  apikey: SHOP.backend.supabaseAnonKey,
  Authorization: `Bearer ${sessionStorage.getItem('sb_admin_token') || SHOP.backend.supabaseAnonKey}`,
  'Content-Type': 'application/json',
});
async function sbRpc(fn, body) {
  const res = await fetch(`${sbUrl}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers: sbHeaders(), body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.message || `RPC ${fn} failed`, data?.code, res.status);
  return data;
}
async function sbTable(method, table, query) {
  const url = `${sbUrl}/rest/v1/${table}${method === 'GET' && query ? `?${query}` : ''}`;
  const res = await fetch(url, {
    method,
    headers: sbHeaders(),
    body: method === 'GET' ? undefined : JSON.stringify(query ?? {}),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.message || `${method} ${table} failed`, data?.code, res.status);
  return data;
}
export class ApiError extends Error {
  constructor(message, code, status) { super(message); this.code = code; this.status = status; }
}

/* ---------- helpers ---------- */
export function generateRef() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I,L,O,0,1 — readable over the phone
  const rnd = new Uint32Array(6);
  const c = globalThis.crypto;
  if (c?.getRandomValues) c.getRandomValues(rnd);
  else rnd.forEach((_, i) => { rnd[i] = Math.floor(Math.random() * 2 ** 32); });
  let s = '';
  rnd.forEach((n) => { s += alphabet[n % alphabet.length]; });
  return `SB-${s}`;
}

const overlaps = (aS, aE, bS, bE) => toMin(aS) < toMin(bE) && toMin(bS) < toMin(aE);

const ls = {
  read(k, fb) { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } },
  write(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
};

/* ---------- PUBLIC API ---------- */

/** Busy intervals for one date: [{start,end,barberId,status}] (HH:MM, shop tz). */
export async function getBusyForDate(dateStr) {
  if (MODE === 'supabase') {
    const rows = await sbRpc('busy_intervals', { p_date: dateStr });
    return rows.map((r) => ({ start: r.start, end: r.end, barberId: r.barber_id, status: r.status }));
  }
  return ls.read(LS_BOOKINGS, [])
    .filter((b) => b.date === dateStr && b.status !== 'cancelled')
    .map((b) => ({ start: b.start, end: b.end, barberId: b.barberId, status: b.status }));
}

/**
 * Create a booking. Resolves the barber for "any barber" (least loaded).
 * @throws ApiError code 'SLOT_TAKEN' on conflict (server-checked in prod).
 */
export async function createBooking(draft) {
  // draft: {serviceId, barberId|'any', date, start, name, phone, email, note, lang}
  const service = SHOP.services.find((s) => s.id === draft.serviceId);
  if (!service) throw new ApiError('Unknown service', 'BAD_SERVICE', 400);
  const end = fromMin(toMin(draft.start) + service.duration);

  if (MODE === 'supabase') {
    const row = await sbRpc('create_booking', {
      p_service_id: draft.serviceId,
      p_barber_id: draft.barberId === 'any' ? null : draft.barberId,
      p_date: draft.date,
      p_start: draft.start,
      p_name: draft.name.trim(),
      p_phone: draft.phone,
      p_email: draft.email || null,
      p_note: draft.note || null,
      p_locale: draft.lang,
    });
    if (row && row.ref) return row;
    throw new ApiError('Slot taken', 'SLOT_TAKEN', 409);
  }

  /* --- local demo mode (client-side check only — replace with backend) --- */
  const bookings = ls.read(LS_BOOKINGS, []);
  const busy = bookings.filter((b) => b.date === draft.date && b.status !== 'cancelled');
  const candidates = draft.barberId === 'any' ? SHOP.barbers.map((b) => b.id) : [draft.barberId];
  const free = candidates.filter((bid) =>
    !busy.some((b) => b.barberId === bid && overlaps(draft.start, end, b.start, b.end)));
  if (free.length === 0) throw new ApiError('Slot taken', 'SLOT_TAKEN', 409);
  const barberId = draft.barberId === 'any' ? pickBarber(free, busy, draft.start) : draft.barberId;
  const booking = {
    ref: generateRef(), serviceId: draft.serviceId, barberId, date: draft.date,
    start: draft.start, end, name: draft.name.trim(), phone: draft.phone,
    email: draft.email || '', note: draft.note || '', lang: draft.lang,
    status: 'booked', createdAt: new Date().toISOString(),
  };
  bookings.push(booking);
  ls.write(LS_BOOKINGS, bookings);
  return booking;
}

/** Look up one booking by reference (row shape differs slightly per backend). */
export async function getBookingByRef(ref) {
  const key = String(ref || '').trim().toUpperCase();
  if (MODE === 'supabase') {
    const rows = await sbTable('GET', 'bookings_view', `ref=eq.${encodeURIComponent(key)}`);
    return rows[0] || null;
  }
  return ls.read(LS_BOOKINGS, []).find((b) => b.ref === key) || null;
}

/** True when free cancellation is still allowed (policy window). */
export function canCancel(booking, now = null) {
  const n = now || shopNow();
  const date = booking.date ?? booking.booking_date;
  const start = booking.start ?? booking.start_time;
  return shopToUtcMs(date, start) - Date.now() >= SHOP.cancellationWindowHours * 3600_000 &&
         date >= n.date;
}

export async function cancelBooking(ref) {
  const key = String(ref || '').trim().toUpperCase();
  if (MODE === 'supabase') {
    await sbRpc('cancel_booking', { p_ref: key });
    return { ok: true };
  }
  const bookings = ls.read(LS_BOOKINGS, []);
  const b = bookings.find((x) => x.ref === key);
  if (!b) throw new ApiError('Not found', 'NOT_FOUND', 404);
  b.status = 'cancelled';
  ls.write(LS_BOOKINGS, bookings);
  return { ok: true };
}

export async function rescheduleBooking(ref, newDate, newStart, barberId) {
  const key = String(ref || '').trim().toUpperCase();
  if (MODE === 'supabase') {
    return sbRpc('reschedule_booking', { p_ref: key, p_date: newDate, p_start: newStart, p_barber_id: barberId || null });
  }
  const cur = await getBookingByRef(key);
  if (!cur) throw new ApiError('Not found', 'NOT_FOUND', 404);
  await cancelBooking(key);
  return createBooking({
    serviceId: cur.serviceId, barberId: barberId || cur.barberId, date: newDate,
    start: newStart, name: cur.name, phone: cur.phone, email: cur.email,
    note: cur.note, lang: cur.lang,
  });
}

/** Walk-in status: {waiting, etaMinutes, updatedAt}. */
export async function getWalkInStatus() {
  if (MODE === 'supabase') {
    try {
      const rows = await sbTable('GET', 'walk_in_status', 'id=eq.1');
      const r = rows[0];
      if (r) return { waiting: r.waiting, etaMinutes: r.eta_minutes, updatedAt: r.updated_at };
    } catch { /* fall through to demo */ }
  }
  const saved = ls.read(LS_WALKIN, null);
  if (saved) return saved;
  // Demo default until the owner updates it from the admin panel.
  return { waiting: 2, etaMinutes: 25, updatedAt: new Date().toISOString(), demo: true };
}

/* ---------- Admin-only operations (auth required server-side via RLS) ---------- */
export async function adminListBookings(fromDate) {
  if (MODE === 'supabase') {
    return sbTable('GET', 'bookings_view', `booking_date=gte.${fromDate}&order=booking_date.asc,start_time.asc&limit=200`);
  }
  return ls.read(LS_BOOKINGS, [])
    .filter((b) => b.date >= fromDate)
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
}

export async function adminCancel(ref) {
  if (MODE === 'supabase') return sbRpc('cancel_booking', { p_ref: ref });
  const bookings = ls.read(LS_BOOKINGS, []);
  const b = bookings.find((x) => x.ref === ref);
  if (b) { b.status = 'cancelled'; ls.write(LS_BOOKINGS, bookings); }
  return b;
}

export async function adminBlockSlot({ date, start, barberId, durationMin, reason }) {
  const end = fromMin(toMin(start) + (durationMin || 30));
  if (MODE === 'supabase') {
    return sbRpc('block_slot', { p_date: date, p_start: start, p_end: end, p_barber_id: barberId, p_reason: reason || null });
  }
  const bookings = ls.read(LS_BOOKINGS, []);
  bookings.push({
    ref: generateRef(), serviceId: null, barberId, date, start, end, name: reason || 'BLOCKED',
    phone: '', email: '', note: '', lang: 'en', status: 'blocked', createdAt: new Date().toISOString(),
  });
  ls.write(LS_BOOKINGS, bookings);
  return { ok: true };
}

export async function adminUpdateWalkIn(waiting, etaMinutes) {
  const payload = { waiting, etaMinutes, updatedAt: new Date().toISOString() };
  if (MODE === 'supabase') {
    return sbRpc('update_walk_in', { p_waiting: waiting, p_eta_minutes: etaMinutes });
  }
  ls.write(LS_WALKIN, payload);
  return payload;
}

/* Supabase admin auth (Phase 2) — email/password against Supabase Auth. */
export async function adminSignIn(email, password) {
  if (MODE === 'supabase') {
    const res = await fetch(`${sbUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SHOP.backend.supabaseAnonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.msg || data.message || 'Login failed', 'AUTH', res.status);
    sessionStorage.setItem('sb_admin_token', data.access_token);
    return { ok: true };
  }
  /* DEMO ONLY — replace with real auth before production. */
  const ok = email === 'demo@salimbarber.tn' && password === 'demo1234';
  if (!ok) throw new ApiError('Invalid credentials', 'AUTH', 401);
  sessionStorage.setItem('sb_admin_token', 'demo');
  return { ok: true };
}

export const adminSignOut = () => sessionStorage.removeItem('sb_admin_token');
export const isAdminSignedIn = () => Boolean(sessionStorage.getItem('sb_admin_token'));
