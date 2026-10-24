# Software Requirements Specification — Salim Barber Shop

**Project:** Trilingual online booking site (EN/FR/AR) for a Tunis barbershop
**Version:** 2.0 · **Date:** 2026-10-24 · **Status:** Approved (baseline for Phase 1 + Phase 2)
**Author:** Solo development team (team of one) · **Client:** Shop owner

---

## 1. Scope, objectives, stakeholders, constraints

### 1.1 Scope
A mobile-first public website that lets customers book barber appointments, in
English, French and Arabic, delivered in two phases:

- **Phase 1 (launch fast):** static trilingual page with all shop content and a
  WhatsApp-first booking flow. No backend, deployable on any static host.
- **Phase 2 (full system):** 4-step online booking wizard on Supabase
  (Postgres), customer reminders, owner notifications, password-protected admin
  panel (bookings, slot blocking, walk-in status), PWA installability.
  Phase 2 reuses Phase 1 files — no rewrite.

Out of scope: online payment, multiple branches, customer accounts/passwords,
native mobile apps, franchise reporting.

### 1.2 Objectives
1. Reduce no-shows and phone interruptions (self-service booking + reminders).
2. Present the shop professionally in the three languages customers actually
   use in Tunisia (AR/FR dominant, EN for visitors).
3. Guarantee booking integrity: no double-booking at any concurrency level.
4. Be operable by a non-technical owner (one config file, one translations folder).

### 1.3 Stakeholders
| Stakeholder | Interest |
|---|---|
| Customer | Book/cancel/reschedule quickly, in their language, on their phone |
| Barber | A sane, readable day schedule; no gaps from no-shows |
| Owner/Admin | Fill the chair, walk-in transparency, minimal admin work |
| System (scheduler) | Send reminders/notifications reliably, keep data consistent |

### 1.4 Constraints
| Constraint | Value |
|---|---|
| Budget | ~0 TND/month (static hosting free tier + Supabase free tier) |
| Timeline | Phase 1 in 2 weeks, Phase 2 in 4 (solo developer) |
| Hosting | Static CDN (Netlify/Vercel/GitHub Pages) + Supabase |
| Team | 1 full-stack developer (+ the owner as product owner/tester) |
| Timezone | All business times in **Africa/Tunis** (UTC+1), stored explicitly |
| Regulation | Tunisian Organic Law 2004-63 (INPDP) + GDPR principles for EU visitors |

---

## 2. Actors
- **Customer** — anonymous visitor, no account; identified by name + phone + reference code.
- **Barber** — resource being booked (not a system user in v2).
- **Owner/Admin** — authenticated user of `admin.html` (Supabase Auth).
- **System** — reminder scheduler (Edge Function cron), database constraints, notification queue.

---

## 3. Functional requirements (MoSCoW)

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | The visitor can switch language (EN/FR/AR) at any time; the choice persists across visits. | Must |
| FR-02 | The site detects the browser language and pre-selects EN/FR/AR, defaulting to French. | Must |
| FR-03 | Arabic switches the whole layout to RTL (`dir="rtl"`, mirrored alignment/icons/spacing). | Must |
| FR-04 | Every user-visible string is translated: nav, buttons, labels, placeholders, validation errors, confirmations, reminders, privacy notice, days, months. | Must |
| FR-05 | The customer can send a booking request via WhatsApp with a pre-filled message (service, date, time, name) in the active language. | Must (P1) |
| FR-06 | The customer can book a service (optionally with a barber) for an available slot in a 4-step wizard with a progress indicator. | Must (P2) |
| FR-07 | The system prevents double-booking (database-enforced; concurrent attempts get SLOT_TAKEN). | Must (P2) |
| FR-08 | Slot generation uses opening hours and service duration on a 15-minute grid; booked/blocked slots are unavailable; closed days disabled; past dates impossible; same-day slots require 30 min lead. | Must (P2) |
| FR-09 | Step 3 validates full name (≥3 chars), Tunisian phone (+216, 8 digits, mobile prefixes 2/4/5/9), optional email, optional note; errors display in the active language. | Must (P2) |
| FR-10 | "Any barber" bookings are auto-assigned to the least-busy free barber at confirmation. | Should (P2) |
| FR-11 | Confirmation screen shows details + reference (SB-XXXXXX), "Add to calendar" (.ics), "Confirm via WhatsApp", "Leave a Google review". | Must (P2) |
| FR-12 | The customer can cancel a booking with the reference number; free up to 3 h before start. | Must (P2) |
| FR-13 | The customer can reschedule with the reference number (guarded, conflict-checked). | Must (P2) |
| FR-14 | The admin can log in (email + password), view upcoming bookings, cancel them, and block slots per barber. | Must (P2) |
| FR-15 | The admin can update the walk-in status ("X waiting, ~Y min") shown on the public page. | Must (P2) |
| FR-16 | The system notifies the owner (WhatsApp/email) of each new booking. | Should (P2) |
| FR-17 | The system sends the customer a reminder ~2 h before the appointment, in the booking language. | Should (P2) |
| FR-18 | The page shows all content sections: hero (+today's hours + open/closed badge), services with duration/price, barbers, gallery, walk-in status, loyalty banner, FAQ (payments, kids, walk-ins, cancellation, rescheduling), contact (address, click-to-call, WhatsApp, map, hours table), footer + privacy link. | Must |
| FR-19 | The privacy notice exists in all three languages; booking data can be deleted on request (and by cancelling). | Must |
| FR-20 | The site is a PWA: manifest, service worker, add-to-home-screen, offline shell. | Should (P2) |
| FR-21 | The WhatsApp form and wizard deploy a honeypot field against spam bookings; the backend rate-limits (max 3 future active bookings per phone). | Should |
| FR-22 | The confirmation `.ics` file carries the correct timezone (Africa/Tunis). | Should |
| FR-23 | When no backend is configured, the site runs in clearly-marked demo mode (localStorage) with the same UX. | Must |
| FR-24 | SEO: per-language title/description, Open Graph, hreflang, LocalBusiness JSON-LD. | Must |
| FR-25 | Privacy-friendly analytics record which language visitors use (no cookies, no PII). | Could |
| FR-26 | Loyalty/referral banner communicates the "every 10th haircut free" offer. | Must |
| FR-27 | Ref codes use an unambiguous alphabet (no I/L/O/0/1) so they can be read over the phone. | Should |
| FR-28 | The admin can mark a booking completed (schedule hygiene). | Could |
| FR-29 | Multi-branch support. | Won't (v2) |
| FR-30 | Online payment/deposits. | Won't (v2) |

---

## 4. Non-functional requirements (measurable)

| Category | Requirement |
|---|---|
| Performance | Lighthouse ≥ 90 for Performance, Accessibility, Best Practices, SEO on mobile; FCP < 2 s on 4G; < 150 KB JS shipped (currently ≈ 40 KB, zero libraries). |
| Availability | ≥ 99 % monthly (static CDN + Supabase SLA); graceful degradation: booking wizard failure leaves the WhatsApp channel usable. |
| Security | OWASP Top 10 controls (§7 of DESIGN.md); parameterized SQL only (RPC/PLpgSQL); rate limiting on booking creation; honeypot; HTTPS-only; CSP/HSTS headers; secrets never in repo. |
| Accessibility | WCAG 2.1 AA: labels on all fields, visible focus states, keyboard-navigable wizard/FAQ, contrast ≥ 4.5:1, `aria-pressed`/`aria-live`/`role=alert`, reduced-motion support. |
| Usability | Booking wizard completable in ≤ 60 s; ≤ 4 steps; all errors actionable and in the active language. |
| Maintainability | Owner edits ONE file (`js/config.js`) + three JSON translation files; ≥ 80 % unit-test coverage of business logic; ADRs for major decisions. |
| Portability | Runs on any static host (Netlify/Vercel/GitHub Pages); backend swappable behind `js/api.js`. |
| Scalability | Stateless frontend on CDN; Postgres constraints; expected load (< 200 bookings/day) far below free tiers. |
| Localization | i18n dictionary-driven; RTL via CSS logical properties; per-locale fonts (Inter / Cairo); `lang`/`dir` attributes updated on switch; dates/times via `Intl`. |

---

## 5. User stories (with acceptance criteria)

Format: **As a** actor **I want** goal **so that** benefit.
Acceptance criteria in Given/When/Then.

### US-01 Switch language (FR-01..04) — Customer
*As a visitor I want the site in my language so that I can book without guessing.*
- **Given** the page in French, **When** I tap "AR", **Then** `html[lang=ar]`, `html[dir=rtl]`, all visible strings are Arabic, brand shows the Arabic name, and my next visit opens in Arabic.

### US-02 Book via WhatsApp (FR-05) — Customer
*As a customer I want to send my booking request on WhatsApp so that I keep using the app I already have.*
- **Given** the form in EN, **When** I submit service/date/time/name, **Then** WhatsApp opens at the shop's number with a prefilled EN message containing all four values.

### US-03 Book online (FR-06..11) — Customer
*As a customer I want a guaranteed slot so that I don't wait.*
- **Given** a service + barber selected, **When** I open step 2, **Then** closed days are disabled and only bookable times are offered.
- **Given** valid details, **When** I confirm, **Then** I see a reference + calendar/WhatsApp/review actions within 3 s.
- **Given** someone took the last slot, **When** I confirm, **Then** I get a translated "slot taken" message and return to time selection.

### US-04 Cancel / reschedule (FR-12/13) — Customer
*As a customer I want to change my plans without calling.*
- **Given** my reference, **When** more than 3 h remain, **Then** I can cancel or move to any free slot; within 3 h the buttons explain the window has expired.

### US-05 Manage the day (FR-14/15/28) — Owner
*As the owner I want today's schedule and live queue control so that I can run the shop.*
- **Given** admin login, **When** bookings exist, **Then** I see them ordered by date/time with cancel buttons; I can block a slot for a barber and set the walk-in status, which updates the public page.

### US-06 Be reminded (FR-17) — Customer / System
*As a customer I want a reminder so that I don't forget.*
- **Given** a booking 2 h away with reminders unsent, **When** the scheduler runs, **Then** I receive a WhatsApp message in my booking language; the notification is marked sent exactly once.

### US-07 Know we're closed (FR-08/18) — Customer
*As a customer I want to see today's hours and live waiting time so that I decide when to come.*
- **Given** a Sunday, **When** I open the site, **Then** the badge says "Closed today" and Sunday shows Closed in the hours table.

---

## 6. Use cases (detailed)

### UC-01 Book appointment (wizard, Phase 2)
**Actor:** Customer · **Precondition:** backend configured (else demo mode).
**Main flow:**
1. Customer opens #booking, wizard appears (step 1: service).
2. Selects service, barber (or "any"), presses Continue.
3. System lists open dates (closed disabled) and available slots.
4. Customer picks date + slot; Continue → details form.
5. Enters name/phone (+216-validated)/optional email/note; Continue → review.
6. Confirms; system creates the booking atomically, queues owner alert + 2 h reminder.
7. Confirmation screen with reference, .ics, WhatsApp confirm, review link.

**Alternative flows:**
- A1 (slot gone): confirm hits SLOT_TAKEN → translated error, return to step 4.
- A2 (invalid details): inline translated error; focus on offending field; no step change.
- A3 (no backend): WhatsApp form remains the primary channel; wizard hidden.

**Exceptions:** network failure at confirm → generic translated error, retry allowed; rate limit (> 3 future bookings per phone) → rejected.

### UC-02 Cancel / reschedule
**Actor:** Customer · **Precondition:** a reference number.
1. Customer enters reference in "Manage your booking".
2. System shows the appointment (lookup by reference).
3. Cancel: confirm dialog → status `cancelled` (data minimised after retention window).
4. Reschedule: pick new date/time from availability (own booking excluded) → atomic move; conflict → translated "slot taken".
**Exceptions:** unknown reference → translated "not found"; < 3 h remaining → cancel/reschedule refused with the policy message.

### UC-03 Admin manages bookings
**Actor:** Owner · **Precondition:** authenticated in `admin.html`.
1. Dashboard lists upcoming bookings (ref, date, time, customer, phone, service, barber, status).
2. Cancel any booking (admin bypasses the customer window).
3. Block a slot: barber + date + start + duration → appears as busy for customers.
4. Update walk-in status: waiting count + ETA → public banner refreshes (5-min poll).
**Exceptions:** non-admin token → empty list / FORBIDDEN from RPCs (RLS).

### UC-04 Receive reminder
**Actor:** System → Customer.
1. Scheduler (cron, every 10 min) fetches due notifications.
2. Customer reminders → WhatsApp template in booking locale.
3. Sent → marked; poison pills (> 1 h retrying) drained with error log.
4. Owner notifications → WhatsApp or email fallback.

---

## 7. Assumptions, risks, mitigations

**Assumptions:** single shop, 3 barbers; TND cash/card on site only; Tunisian
mobile phones for customers; WhatsApp installed by most customers; shop has
stable opening hours; Supabase free tier sufficient.

| Risk | Prob. | Impact | Mitigation |
|---|---|---|---|
| Owner never updates walk-in status → stale info | High | Medium | page shows "updated at" time; admin form is one tap |
| WhatsApp API not configured → reminders silently off | Medium | Medium | provider-optional design: queue drains to logs; e2e check in admin runbook |
| Double-booking via race | Low | High | DB exclusion constraint + advisory locks (cannot be bypassed by clients) |
| Spam/joke bookings | Medium | Medium | honeypot + 3-active-bookings-per-phone + cancel by ref |
| Translation typo in Arabic | Medium | Low | parity test blocks missing keys; native review in DoD |
| Supabase free tier limits | Low | Medium | usage far below caps; schema portable (plain Postgres) |
| Timezone bugs (visitor in another TZ) | Medium | High | all logic uses Africa/Tunis naive strings + `shopNow()`; unit-tested |
| Owner loses admin password | Low | Medium | Supabase Auth recovery by email |
| Data breach of names/phones | Low | High | RLS, no direct table access, HTTPS, CSP, minimal retention, backups |

---

## 8. Traceability matrix

Requirement → Design element (file/section) → Test cases (see TEST_PLAN.md).

| FR | Design element | Unit tests | E2E / integration |
|---|---|---|---|
| FR-01 language switch | `js/i18n.js` | i18n.test.js: detection/RTL | booking.spec: persists across reload |
| FR-02 detection | `detectLanguage()` | i18n.test.js | — |
| FR-03 RTL | `css/styles.css` logical props, `i18n.setLanguage` | i18n.test.js (RTL langs) | e2e: `dir=rtl` for AR |
| FR-04 all strings | `js/translations/*.json` | parity tests | e2e per language |
| FR-05 WhatsApp message | `js/booking.js`, `js/whatsapp.js` | whatsapp.test.js | e2e: wa.me popup |
| FR-06 wizard | `js/wizard.js` | — | e2e: 4 steps × 3 languages |
| FR-07 no double-booking | `schema.sql` exclusion + locks; `api.js` | slots.test.js (overlap) | integration: parallel inserts (manual) |
| FR-08 slot generation | `js/slots.js` + `available_slots()` | slots.test.js (all cases) | e2e: Sunday disabled |
| FR-09 validation | `js/validation.js` | validation.test.js | e2e: bad phone error |
| FR-10 any-barber assignment | `pickBarber()` | slots.test.js | e2e step 1 |
| FR-11 confirmation | `wizard.js` renderConfirmation, `ics.js` | ics.test.js | e2e: ref + buttons |
| FR-12 cancel | `manage.js`, `cancel_booking()` | — | e2e admin; unit policy via canCancel |
| FR-13 reschedule | `manage.js`, `reschedule_booking()` | slots availability reuse | e2e manual |
| FR-14 admin panel | `admin.html`, `admin.js`, RLS | — | e2e: login + list |
| FR-15 walk-in | `walk_in_status`, admin form | config.test (hours) | e2e: update reflects |
| FR-16 owner notify | `notifications` table + edge fn | — | integration manual |
| FR-17 reminders | `send-reminders` + queue | — | integration manual |
| FR-18 sections | `index.html` | check.mjs assets | e2e smoke |
| FR-19 privacy | dialog + translations | parity tests | manual |
| FR-20 PWA | `manifest.webmanifest`, `sw.js` | — | manual install + Lighthouse |
| FR-21 anti-spam | honeypot + RPC guard | validation.test (honeypot) | integration |
| FR-22 .ics tz | `ics.js` TZID | ics.test.js | manual import |
| FR-23 demo mode | `api.js` MODE | — | e2e runs in demo mode |
| FR-24 SEO | `index.html` head + JSON-LD | check.mjs | Lighthouse SEO |
| FR-25 analytics hook | `i18n.js` `__sbAnalytics` | — | manual |
| FR-26 loyalty banner | `index.html` section | parity | e2e smoke |
| FR-27 ref alphabet | `generateRef()` | (format asserted) | e2e ref regex |
| FR-28 completed status | enum + admin | — | manual |

---

## 9. Change log
- 2026-10-24 v2.0 — baseline covering Phase 1 + Phase 2 (this document).
