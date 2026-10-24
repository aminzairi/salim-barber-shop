# ADR-005 — Double-booking defence in the database (constraint + advisory locks)

**Status:** Accepted · **Date:** 2026-10-24

## Context
Two customers pressing "confirm" on the last chair at the same instant must
never both succeed (FR-07). Client-side filtering is only UX.

## Decision
Three layers, authoritative at the bottom:
1. **UX** — taken slots are hidden/disabled (`slots.js` availability).
2. **Application** — `create_booking()` takes a transaction-scoped
   `pg_advisory_xact_lock(hash(barber, date))` so the free-barber search and
   the INSERT are atomic across concurrent "any barber" requests.
3. **Database** — exclusion constraint
   `EXCLUDE USING gist (barber_id WITH =, tstzrange(start_at,end_at) WITH &&)
   WHERE (status IN ('booked','blocked'))` rejects any overlap regardless of
   the caller. Losers receive `SLOT_TAKEN` → HTTP 409 → the wizard shows the
   translated retry and returns to time selection.

## Alternatives rejected
- Application-only check (TOCTOU race window); unique index on
  `(barber_id, start_at)` (fails for overlapping-but-not-equal starts, and
  would block legitimate adjacent bookings of different durations).
