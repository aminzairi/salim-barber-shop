# Maintenance Guide — Salim Barber Shop

For the developer/maintainer. Owner-facing tasks: [USER_GUIDE.md](USER_GUIDE.md).

---

## 1. Run, check, test locally

```bash
npm test            # unit tests (no install needed)
node scripts/check.mjs   # parse + asset + translation parity checks
npm run serve       # http://localhost:4173  (demo mode)
# demo of the Phase 2 wizard without a backend:
open http://localhost:4173/#demo-wizard
npm ci && npx playwright install --with-deps && npm run test:e2e
```

## 2. Add a new service
1. `js/config.js` → add `{ id: 'shave', duration: 20, price: 12 }` to `services`.
2. `js/translations/{en,fr,ar}.json` → add `"shave": "…"` under
   `services.names` (**all three files** — the parity test enforces it).
3. If live: `backend/supabase/seed.sql` → add the row, run in Supabase SQL
   editor (`on conflict do update`).

## 3. Add a new barber
1. `js/config.js` → `barbers` + photo `img/barber-<id>.svg` (square ≥ 300 px).
2. Translations: `barbers.names.<id>` + `barbers.specialties.<id>` ×3 files.
3. `seed.sql` → insert into `barbers`.
4. Already-booked slots are per barber — adding one never conflicts.

## 4. Add a new language (e.g., Spanish)
1. `js/translations/es.json` — full copy of `en.json`, translated (keep keys).
2. `js/i18n.js` → add `'es'` to `SUPPORTED` (and to `RTL_LANGS` if RTL).
3. Fonts: add the family for ES in `index.html` link + `styles.css` if needed.
4. Tests (`i18n.test.js`, `scripts/check.mjs`) automatically include ES —
   parity failures point to missing keys.
5. `index.html` → add `hreflang="es"` link; `schema.sql` locale CHECK needs
   the new code; `send-reminders/index.ts` → add message templates.

## 5. Backend operations (Supabase)
- **First setup / go live:** create project → SQL editor → run `schema.sql`
  then `seed.sql` → Authentication → add your admin user → `insert into
  admins (user_id) values ('<uuid>');` → copy URL + anon key into
  `js/config.js` → deploy. Wizard + manage + admin switch to live mode.
- **Secrets** (Supabase → Edge Functions → Secrets): see `.env.example`.
  Reminder cron: Dashboard → Integrations → Cron → `send-reminders` every
  10 minutes.
- **Backups:** Supabase takes daily snapshots on every plan; additionally
  `supabase db dump` weekly to private storage. Data minimisation: keep
  bookings 6 months (`seed.sql` has the pg_cron purge snippet).
- **Delete customer data on request:** delete the booking row (admin cancel +
  purge, or `delete from bookings where customer_phone='+216…';`) — cascades
  remove queued notifications.

## 6. Release checklist
1. `npm test && node scripts/check.mjs && npm run test:e2e` green.
2. Bump `CACHE_VERSION` in `sw.js` when assets changed.
3. Update `CHANGELOG.md` (Keep a Changelog) + `package.json` version (SemVer).
4. Merge `develop` → `main` (CI deploys staging on develop, production on main).
5. Post-release: Lighthouse spot check on the deployed URL, and one real
   booking through WhatsApp to verify alerts.

## 7. Monitoring
- **Uptime:** point a free monitor (e.g., UptimeRobot) at `/` and at the
  Supabase REST endpoint (expect 200/401).
- **Errors:** Supabase → Logs → Edge functions; browser errors: wire
  `window.onerror` → Sentry (free tier) — one script tag + CSP addition.
- **Booking health:** admin panel daily; `notifications` rows stuck
  `sent_at is null` > 1 h indicate provider problems (check secrets/quota).

## 8. Known limits / TODO markers
- `TODO: replace with the shop's real Google review link` — `js/config.js`.
- Demo credentials `demo@salimbarber.tn / demo1234` in `js/api.js`
  (DEMO ONLY — never rely on them with a real backend configured).
- Gallery/barber images are placeholders (`img/*.svg`) — replace with photos.
- `og-cover.svg` is an SVG placeholder; social crawlers prefer PNG/JPG.
- `img/icon-*.png` are generated placeholders (`npm run icons`) — replace with
  branded artwork (same filenames/sizes).
