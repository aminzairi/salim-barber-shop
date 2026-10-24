# ADR-002 — Supabase as the Phase 2 backend

**Status:** Accepted · **Date:** 2026-10-24

## Context
Phase 2 needs persistent bookings with a hard no-double-booking guarantee
(FR-03/07), admin auth, reminders and a free tier. Candidates: Firebase,
Node+SQLite (self-host), Google Sheets + Apps Script, Supabase.

## Decision
Supabase (hosted Postgres + RLS + Auth + scheduled Edge Functions), accessed
from the browser through a thin `fetch` REST client (`js/api.js`) — no SDK.

## Rationale
- **Relational constraints are the only airtight double-booking defence:**
  the `EXCLUDE USING gist (barber_id, tstzrange(start,end) WITH &&)` constraint
  cannot be bypassed by any client. Firestore has transactions but no
  declarative overlap guard; Sheets has neither.
- SQL schema maps 1:1 to the ER diagram and is portable to any Postgres.
- Auth (admin) + RLS + cron + webhooks included; free tier ample for one shop.
- Zero-cost demo path: same interface over localStorage keeps Phase 1 intact.

## Consequences
Vendor-coupling is limited to REST/RPC calls in one module; a self-hosted
Postgres (or Node API) can replace it by re-implementing `api.js` only.
Reminder delivery depends on WhatsApp/Resend being configured — the queue
degrades to logs instead of failing bookings.
