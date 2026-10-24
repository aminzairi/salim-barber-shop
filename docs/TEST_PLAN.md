# Test Plan — Salim Barber Shop

**Version:** 2.0 · Links: requirements in [SRS.md](SRS.md), design in [DESIGN.md](DESIGN.md).

---

## 1. Strategy (test pyramid)

| Level | Tool | Scope | When |
|---|---|---|---|
| Unit (fast, 0 deps) | `node --test` (`npm test`) | slot engine, validation, i18n parity, WhatsApp messages, .ics, date helpers, config coherence | every commit (CI) |
| Static checks | `node scripts/check.mjs` + ESLint | parse errors, missing assets, translation key parity | every commit (CI) |
| E2E (browser) | Playwright (`npm run test:e2e`) | full booking flow ×3 languages, RTL, persistence, admin demo | pushes to main/develop (CI) |
| Integration (backend) | Supabase SQL editor / curl script | RPC behaviour, double-booking concurrency, RLS | before each backend deploy |
| Accessibility | axe (via Playwright) + manual keyboard pass | WCAG 2.1 AA | per release |
| Performance | Lighthouse CI (mobile) | ≥ 90 × 4 categories, FCP < 2 s | per release |

**Coverage target:** ≥ 80 % on business logic (`js/slots.js`, `validation.js`,
`shopTime.js`, `whatsapp.js`, `ics.js`, `i18n.js`) — currently all branches of
these modules are exercised by `tests/unit` (44 tests).

**Definition of Done:** code reviewed · unit+static+e2e green · documented ·
keyboard-accessible · strings present in EN+FR+AR (parity test) · Lighthouse
mobile ≥ 90 · CHANGELOG updated.

---

## 2. Test cases

Legend: Method = U(nit)/E(2E)/I(ntegration)/M(anual). Req = SRS FR id.

| ID | Req | Method | Title | Steps | Expected |
|---|---|---|---|---|---|
| TC-01 | FR-01 | E | Language switch updates the document | tap EN/FR/AR in header | `html[lang]` and all strings switch; brand name Arabic in AR |
| TC-02 | FR-01 | E | Language persists across reloads | choose AR, reload, reopen `/` | page loads in AR (localStorage) |
| TC-03 | FR-02 | U/E | Browser detection | open with `Accept-Language: it-IT,fr-FR` | French preselected (fallback); `ar-TN` → Arabic; `en-GB` → English |
| TC-04 | FR-03 | E | RTL layout mirrors | switch to AR | `dir="rtl"`; nav/hero/cards mirrored via logical properties; no overflow at 360 px |
| TC-05 | FR-04 | U | Translation parity | `npm test` | EN/FR/AR key sets identical; FAQ 6 items each |
| TC-06 | FR-05 | E | WhatsApp prefilled message | fill Phase-1 form (EN) → submit | popup to `wa.me/21622345678?text=…` containing service/date/time/name in EN |
| TC-07 | FR-05 | U | Message language follows UI | builder unit tests ×3 | FR starts "Bonjour", AR uses Arabic shop name |
| TC-08 | FR-06 | E | Wizard 4 steps happy path ×3 languages | select service→barber→date→slot→details→confirm | confirmation with `SB-[A-Z2-9]{6}` ref, all buttons translated |
| TC-09 | FR-08 | U | Closed days disabled | availability on Sunday | no slots; Sunday date chip disabled |
| TC-10 | FR-08 | U | Past dates rejected | `validateBookingDate('2026-10-23', now=2026-10-24)` | `datePast` error |
| TC-11 | FR-08 | U | Duration fits before closing | candidate grid for 45-min service | last start 19:15 (09:00–20:00) |
| TC-12 | FR-08 | U | Same-day lead time | now 14:40, lead 30 min | 15:00 hidden, 15:15 shown |
| TC-13 | FR-09 | U/E | Valid +216 numbers | `22 123 456`, `+216 98 765 432`, `00216-45-123-987`, `21655123456` | all normalize to `+216XXXXXXXX` |
| TC-14 | FR-09 | U/E | Invalid +216 numbers | `71 123 456`, `22 123 45`, `+336…`, letters | rejected; wizard shows translated phone error |
| TC-15 | FR-07 | U | Overlap filtering | salim busy 10:00–10:30 | 09:45 & 10:00 hidden for salim; 10:30 shown; karim unaffected |
| TC-16 | FR-07 | I | **Double-booking race** | run two parallel `create_booking` for last free barber | exactly one succeeds, other returns SLOT_TAKEN; DB shows one row |
| TC-17 | FR-07 | I | Direct table insert blocked | anon INSERT into bookings | RLS/permission denied |
| TC-18 | FR-10 | U | Any-barber union + least-loaded pick | 2 of 3 barbers busy | slot offered; assigned barber = least loaded |
| TC-19 | FR-11 | E | Confirmation actions | after booking | ref shown; .ics downloads; WhatsApp link contains ref; review link present |
| TC-20 | FR-22 | U/M | .ics timezone | import into Google Calendar | event at shop-local time (TZID Africa/Tunis), duration correct |
| TC-21 | FR-12 | E/M | Cancel by reference | find booking → cancel (>3 h ahead) | status cancelled; slot becomes bookable again |
| TC-22 | FR-12 | M | Cancel window expired | booking <3 h away | cancel refused with translated policy message |
| TC-23 | FR-13 | M | Reschedule by reference | move to another free slot | moved atomically; old slot freed; conflict → "slot taken" |
| TC-24 | FR-14 | E | Admin login + list | demo credentials on admin.html | dashboard lists upcoming bookings ordered; cancel works |
| TC-25 | FR-14 | I | Admin authorization | call `block_slot` with anon key | FORBIDDEN |
| TC-26 | FR-15 | E | Walk-in status round-trip | set 4 waiting in admin | public banner shows "4 people waiting · ~Y min" |
| TC-27 | FR-17 | I | Reminder scheduling | booking 2 h ahead → run send-reminders | WhatsApp payload in booking locale; notification marked sent once |
| TC-28 | FR-16 | I | Owner notification | create booking | owner alert queued/sent (or logged if provider off) |
| TC-29 | FR-21 | U | Honeypot | fill hidden company field | submission silently ignored |
| TC-30 | FR-21 | I | Rate limit | 4th future booking same phone | TOO_MANY_ACTIVE |
| TC-31 | FR-20 | M | PWA install | Lighthouse → install on Android | installable; opens standalone; offline shell loads |
| TC-32 | NFR | M | Mobile screen sizes | 320/390/768/1024/1440 px | no horizontal scroll; grids reflow; touch targets ≥ 44 px |
| TC-33 | NFR | M | Keyboard navigation | tab through wizard/FAQ/contact | visible focus, logical order, Enter activates; FAQ is `<details>` |
| TC-34 | NFR | M | Screen reader spot check | NVDA/VoiceOver on booking form | fields announce labels; errors announced via `role=alert` |
| TC-35 | NFR | M | Lighthouse mobile | run on deployed URL | ≥ 90 Performance/A11y/Best-Practices/SEO; FCP < 2 s |
| TC-36 | FR-23 | E | Demo mode | no backend configured | wizard works on localStorage with visible demo notice |
| TC-37 | FR-18 | M | Sections present | scroll page | 11 sections per brief, all translated incl. footer privacy |
| TC-38 | FR-24 | M | SEO | view source ×3 langs | per-lang title/description, hreflang set, LocalBusiness JSON-LD |
| TC-39 | FR-19 | M | Privacy dialog | open in each language | 3-paragraph notice translated; mentions 2004-63/GDPR + deletion |

---

## 3. Integration test script (run against a staging Supabase)

```bash
# 1) schema + seed applied, then:
curl -s -X POST "$SB_URL/rest/v1/rpc/busy_intervals" -H "apikey: $ANON" \
  -H "Content-Type: application/json" -d '{"p_date":"2026-10-26"}'          # → []
# 2) create two overlapping bookings for the last free barber in parallel:
for i in 1 2; do
  curl -s -X POST "$SB_URL/rest/v1/rpc/create_booking" -H "apikey: $ANON" \
    -H "Content-Type: application/json" -d '{
      "p_service_id":"haircut","p_barber_id":"yassine","p_date":"2026-10-26",
      "p_start":"11:00","p_name":"Race Test","p_phone":"+21622111222","p_locale":"fr"}' &
done; wait    # exactly one {"ref":...}; the other raises SLOT_TAKEN
# 3) anon must NOT insert directly:
curl -s -X POST "$SB_URL/rest/v1/bookings" -H "apikey: $ANON" \
  -H "Content-Type: application/json" -d '{"ref":"SB-HACK"}'               # → permission denied
```

---

## 4. Static analysis
- **ESLint 9** flat config (`eslint.config.js`): no unused vars, `eqeqeq`,
  `no-var`, `prefer-const`, no-undef with browser/test globals.
- **Prettier**: recommended config, 100-col, single quotes (editor-level).
- **HTML/CSS**: `scripts/check.mjs` verifies asset references and module
  parsing; W3C validator is part of the release checklist.

## 5. CI gates
`quality` (lint → check → unit) must pass on every PR; `e2e` runs on pushes;
deployment jobs depend on green gates (see `.github/workflows/ci.yml`).
