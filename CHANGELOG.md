# Changelog

All notable changes. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versioning: [SemVer](https://semver.org). Dates: 2026 calendar.

## [2.0.0] — 2026-10-24 — Phase 2: full booking system

### Added
- 4-step booking wizard with progress indicator (service+barber, date+time,
  details, review) — `js/wizard.js`, mounted automatically when a backend is
  configured.
- Slot engine `js/slots.js` (15-min grid, duration fit, lead time, per-barber
  and any-barber availability) mirrored in SQL `available_slots()`.
- Supabase backend: `backend/supabase/schema.sql` — tables, CHECKs, indexes,
  RLS, `bookings_no_overlap` exclusion constraint + advisory locks
  (**no double-booking, DB-enforced**), RPCs (create/cancel/reschedule/block/
  walk-in), notification queue, `bookings_view` (admin).
- Cancel / reschedule by reference with 3-hour policy — `js/manage.js`.
- Admin panel `admin.html` + `js/admin.js`: Supabase Auth login, bookings
  table, cancel, slot blocking, walk-in status updates.
- Owner notifications + ~2h customer reminders (in booking language) via
  `backend/functions/send-reminders` (WhatsApp Cloud API / Resend, optional).
- `.ics` add-to-calendar with TZID Africa/Tunis — `js/ics.js`.
- PWA: `manifest.webmanifest`, offline service worker `sw.js`, icons.
- Demo mode (localStorage) with visible demo notices when no backend is set.
- OpenAPI 3.1 contract — `api/openapi.yaml`.
- Playwright e2e suite (booking ×3 languages, RTL, persistence, admin).
- CI/CD (GitHub Actions): lint → static check → unit → e2e → staging/production.
- Security headers (CSP, HSTS, XFO…) in `netlify.toml` / `vercel.json`.

## [1.0.0] — 2026-10-24 — Phase 1: trilingual WhatsApp-first site

### Added
- Trilingual static site (EN/FR/AR): hero with today's hours + open/closed
  badge, services, barbers, gallery, walk-in banner, loyalty banner, FAQ,
  contact with hours table, footer + privacy dialog — all 11 brief sections.
- i18n engine: browser detection (FR fallback), persistence, `dir=rtl` flip,
  `{placeholder}` interpolation, `sb:langchange` observer; full JSON
  dictionaries for the three languages (incl. validation errors and privacy).
- WhatsApp booking form with honeypot and prefilled language-correct message.
- Business config single source of truth — `js/config.js`.
- Mobile-first dark & gold theme with CSS logical properties (RTL mirror).
- SEO: per-language meta, OG, hreflang, HairSalon JSON-LD.
- Unit tests (44) for slots/validation/i18n/whatsapp/ics/config + static
  checker (translation parity, asset references).
- Docs: SRS (MoSCoW + traceability), DESIGN (5 Mermaid UML, ER, algorithms),
  TEST_PLAN, USER_GUIDE, MAINTENANCE_GUIDE, 5 ADRs, ASSUMPTIONS.

## [Unreleased]
- Replace placeholder identity (name/address/phone/review link) with real data.
- Real photos for gallery/barbers/OG cover; branded PWA icons.
