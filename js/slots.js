/* =============================================================================
 * SLOT GENERATION (pure) — the canonical algorithm, mirrored in SQL
 * (backend/supabase/schema.sql, function available_slots). See docs/DESIGN.md
 * for the step-by-step explanation and the concurrency strategy.
 *
 * A slot is bookable when:
 *   1. it starts on the step grid (default 15 min) within opening hours,
 *   2. the whole service [start, start+duration) fits before closing,
 *   3. it does not overlap that barber's busy intervals (bookings/blocks),
 *   4. it starts at least `minLeadMinutes` from now (shop time).
 * "Any barber" = slot offered if at least ONE barber is free (Strategy).
 * ========================================================================== */
import { toMin, fromMin } from './shopTime.js';

/** Steps 1–2: candidate grid for one day, fitting the service duration. */
export function candidateSlots(dayHours, serviceDuration, stepMinutes) {
  if (!dayHours) return [];
  const open = toMin(dayHours.open);
  const close = toMin(dayHours.close);
  const slots = [];
  for (let m = open; m + serviceDuration <= close; m += stepMinutes) {
    slots.push({ start: fromMin(m), end: fromMin(m + serviceDuration) });
  }
  return slots;
}

const overlaps = (aStart, aEnd, bStart, bEnd) => toMin(aStart) < toMin(bEnd) && toMin(bStart) < toMin(aEnd);

/**
 * Full availability for a date.
 * @param {object} cfg      SHOP config
 * @param {string} dateStr  "YYYY-MM-DD"
 * @param {Array}  bookings [{start:'HH:MM', end:'HH:MM', barberId}] — concrete barber always
 * @param {object} opts     {serviceId, barberId|'any', now?:{date,time}}
 * @returns {{slots: string[], freeBarbersBySlot: Object.<string, string[]>}}
 */
export function availabilityFor(cfg, dateStr, bookings, opts) {
  const { serviceId, barberId, now } = opts;
  const service = cfg.services.find((s) => s.id === serviceId);
  if (!service) return { slots: [], freeBarbersBySlot: {} };

  const [y, m, d] = dateStr.split('-').map(Number);
  const dayHours = cfg.hours[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const candidates = candidateSlots(dayHours, service.duration, cfg.slotStepMinutes);

  const isToday = now != null && now.date === dateStr;
  const earliest = isToday ? toMin(now.time) + cfg.minLeadMinutes : -1;

  const freeBarbersBySlot = {};
  const slots = [];
  for (const cand of candidates) {
    if (toMin(cand.start) < earliest) continue;
    const wanted = barberId === 'any' || barberId == null
      ? cfg.barbers.map((b) => b.id)
      : [barberId];
    const free = wanted.filter((bid) =>
      !bookings.some((b) => b.barberId === bid && overlaps(cand.start, cand.end, b.start, b.end)));
    if (free.length > 0) {
      slots.push(cand.start);
      freeBarbersBySlot[cand.start] = free;
    }
  }
  return { slots, freeBarbersBySlot };
}

/** Pick the barber for an "any barber" booking: least loaded at that slot. */
export function pickBarber(freeBarbers, bookings, slotStart) {
  const load = (bid) => bookings.filter((b) => b.barberId === bid).length;
  return [...freeBarbers].sort((a, b) => load(a) - load(b))[0];
}
