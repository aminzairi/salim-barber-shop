# Salim Barber Shop — trilingual online booking (EN / FR / العربية)

> **Live site:** https://salim-barber-shop.netlify.app ·
> **Repo:** https://github.com/aminzairi/salim-barber-shop

Production-ready, mobile-first booking site for a Tunisian barbershop.
**Phase 1:** static trilingual page + WhatsApp-first booking (no backend).
**Phase 2:** 4-step booking wizard on Supabase, reminders, owner
notifications, admin panel, PWA. Phase 2 builds on Phase 1 — no rewrite.

| | |
|---|---|
| Languages | English (LTR) · Français (LTR) · العربية (RTL, full mirror) |
| Stack | Vanilla ES modules + modern CSS · Supabase (Postgres, RLS, Edge Functions) · zero runtime deps (~40 KB JS) |
| Style | Dark & gold, WCAG 2.1 AA contrast, CSS logical properties for RTL |
| Times | All booking logic in **Africa/Tunis** explicitly |
| Tests | 44 unit tests (node:test, 0 deps) + Playwright e2e ×3 languages + static checker |

![mobile-first](img/og-cover.svg)

## Features

- **Trilingual everywhere** — nav, forms, validation errors, WhatsApp messages,
  reminders, privacy notice; browser detection with French fallback; choice
  persisted; `dir="rtl"` flip for Arabic.
- **Booking** — Phase 1 WhatsApp form with prefilled message; Phase 2 wizard
  (service+barber → date+time → details → review) with 15-min slot grid,
  closed days disabled, 30-min same-day lead, +216 phone validation, honeypot.
- **No double-booking, guaranteed** — Postgres exclusion constraint +
  advisory locks; concurrent losers get a translated “slot taken” retry.
- **Confirmation** — reference `SB-XXXXXX`, `.ics` add-to-calendar
  (TZID Africa/Tunis), WhatsApp confirm, Google review link.
- **Self-service manage** — cancel/reschedule by reference (3-hour window).
- **Admin** (`/admin.html`) — bookings list, cancel, block slots, live
  walk-in status (“X waiting, ~Y min”).
- **Reminders & alerts** — customer reminder ~2 h before (in booking
  language), owner alert per booking (WhatsApp/email, optional providers).
- **PWA** — manifest, service worker, offline shell, add-to-home-screen.
- **SEO & privacy** — per-language meta, hreflang, LocalBusiness JSON-LD,
  CSP/HSTS headers, privacy notice ×3, minimal data, deletion on request
  (INPDP 2004-63 / GDPR principles).
- **Demo mode** — without a backend the same UX runs on localStorage,
  clearly marked; flip to production by filling two config values.

## Quick start

```bash
npm test                 # unit tests — no install required (Node ≥ 20)
node scripts/check.mjs   # parse + assets + translation parity
npm run serve            # → http://localhost:4173  (demo mode)
# Phase 2 wizard demo without a backend:
#   open http://localhost:4173/#demo-wizard
# Admin demo: http://localhost:4173/admin.html
#   demo@salimbarber.tn / demo1234   (DEMO ONLY)
```

**Admin panel (owner):** [`/admin`](https://salim-barber-shop.netlify.app/admin) — upcoming
bookings, cancel, block slots, live walk-in status. In demo mode use
`demo@salimbarber.tn / demo1234`; in production it's the Supabase Auth account
you create in "Go live" step 2. The page is `noindex` and not linked anywhere
on the public site.

## Go live (Phase 2 backend)

1. Create a [Supabase](https://supabase.com) project → SQL editor → run
   `backend/supabase/schema.sql`, then `seed.sql`.
2. Authentication → Users → add the owner; then
   `insert into admins (user_id) values ('<auth-user-uuid>');`
3. Copy the project URL + **anon key** into `js/config.js → SHOP.backend`
   (never the service-role key).
4. (Optional) set Edge Function secrets (WhatsApp/Resend — see
   `.env.example`) and schedule `send-reminders` every 10 minutes.
5. Deploy (below). The wizard, manage and admin switch from demo to live
   automatically.

## Deploy

**Netlify (primary)** — `netlify.toml` included (headers, redirects):
connect repo, publish directory `.`. **Vercel** — `vercel.json` included.
**GitHub Pages** — push, Settings → Pages → branch `main` / root.
CI (`.github/workflows/ci.yml`) runs lint/check/unit on PRs, e2e on pushes,
deploys staging from `develop` and production from `main`.

## Project layout

```
index.html · admin.html · css/styles.css · js/ (config, i18n+translations,
slots, validation, api, wizard, manage, admin, …) · sw.js · manifest
backend/supabase/{schema,seed}.sql · backend/functions/{send-reminders,notify-owner}
api/openapi.yaml · tests/{unit,e2e} · scripts/ · docs/
```

## Documentation

| Doc | Content |
|---|---|
| [docs/SRS.md](docs/SRS.md) | requirements (MoSCoW), user stories, use cases, risks, **traceability matrix** |
| [docs/DESIGN.md](docs/DESIGN.md) | architecture, 5 UML (Mermaid) diagrams, ER, slot algorithm, security (OWASP) |
| [docs/TEST_PLAN.md](docs/TEST_PLAN.md) | test pyramid, 39 test cases, integration scripts, DoD |
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | owner manual: bookings, prices, hours, walk-in status |
| [docs/MAINTENANCE_GUIDE.md](docs/MAINTENANCE_GUIDE.md) | add service/barber/language, backups, release checklist |
| [docs/adr/](docs/adr) | 5 Architecture Decision Records |
| [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md) | assumptions + open questions for the owner |
| [CHANGELOG.md](CHANGELOG.md) | semantic versioning history |

## Configuration

- **All business data** (`js/config.js`): name, address, phone, WhatsApp,
  hours, services/prices/durations, barbers, policies, backend keys.
- **All wording** (`js/translations/{en,fr,ar}.json`).
- **Secrets** → env / Supabase secrets only (`.env.example` template).

## Versioning & workflow

SemVer + Keep-a-Changelog · `main` (production) / `develop` (staging) /
`feature/*` branches · Conventional Commits · PR checklist: tests green,
3-language parity, a11y pass, CHANGELOG entry.

## License
Proprietary — © Salim Barber Shop. (Choose an OSS license only if you open-source it.)
