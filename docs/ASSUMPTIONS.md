# Assumptions & Open Questions

## Assumptions made (confirmed with the client brief or safe defaults)
1. **Business details** are samples (name "Salim Barber Shop", Avenue Habib
   Bourguiba address, +216 22 345 678) — owner replaces them in
   `js/config.js` + `index.html` JSON-LD + `seed.sql` (5-minute job).
2. Hours **Mon–Sat 09:00–20:00, Sunday closed** (from the brief's example);
   no lunch break.
3. Services/prices exactly as the brief's example (4 services, 10–22 TND).
4. Payment: **cash + card on site**, no online payment.
5. Cancellation policy: **free up to 3 hours before** start (brief example).
6. Loyalty: **every 10th haircut free** (brief example) — banner only; the
   stamp card is managed physically at the shop (no software tracking in v2).
7. Barbers: 3 sample barbers with "any barber" default; photos are
   placeholders.
8. Customer language for reminders = the language active when booking.
9. One shop, one timezone (Africa/Tunis), ≤ 3 chairs — the model supports
   fewer/more via config.
10. Supabase free tier + Netlify free tier fit the traffic profile
    (a neighbourhood shop, not a chain).
11. Admin = the owner (single admin account); no staff roles in v2.
12. Reminders/notifications are optional integrations (WhatsApp Cloud API /
    Resend); without them the site books normally and the queue drains to logs.

## Open questions for the owner
1. Real shop name, address, phone/WhatsApp number, Google review link?
2. Real opening hours — any lunch break? Ramadan hours (special schedule)?
3. Are the sample services/prices/barbers final? Kids policy (age limit)?
4. Preferred owner-notification channel: WhatsApp, email, or both?
5. Should a booking require confirmation by the owner before it's guaranteed,
   or is instant confirmation acceptable (current behaviour)?
6. Deposit/no-show fee policy in the future? (Currently none.)
7. Real photos/logo/brand assets, and the Instagram handle for the gallery?
8. Domain name (assumed `salimbarber.tn` in SEO tags — placeholder)?
9. Who owns the app-store-style accounts (Supabase, Netlify, Google Business)
    and their 2FA recovery?
10. Data retention preference (assumed 6 months purge for past bookings)?
