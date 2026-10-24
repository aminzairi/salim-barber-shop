# Owner's User Guide — Salim Barber Shop website

This guide is for the shop owner. No technical knowledge required.
Everything below happens in **two places only**:

1. **`js/config.js`** — your shop's facts (name, address, phone, hours,
   services, prices, barbers, policies).
2. **`js/translations/`** — three text files: `en.json`, `fr.json`, `ar.json`.

---

## 1. Your admin panel (`/admin.html`)

Open `https://your-site/admin.html` and sign in with your email + password.

### Upcoming bookings
The table lists every booking from today forward: reference, date, time,
customer, phone, service, barber, status. Newest at bottom. Refresh by
reloading the page.

- **Cancel a booking** → press **Cancel** on its row. The customer's slot
  immediately becomes bookable again.
- The **Ref** column is the code a customer quotes when calling.

### Block a slot (day off, lunch, event)
Barber → Date → Start → Duration → **Block**. The range disappears from the
website for that barber. Cancel it like a booking to unblock.

### Walk-in status ("Currently X waiting, ~Y min")
Set **People waiting** and **Estimated wait**, press **Update**. The home page
banner updates within ~5 minutes. Update it whenever the queue changes —
customers see the last update time, so keep it fresh.

---

## 2. Everyday changes

### Change a price or duration
`js/config.js` → `services` (and `backend/supabase/seed.sql` values if you are
live — see §4). Price is in TND, duration in minutes. One line per service.

### Change opening hours
`js/config.js` → `hours`. `null` = closed. Example — closing at 18:00 on
Saturdays and closing Monday:

```js
hours: [ null, null, {open:'09:00',close:'20:00'}, /*Tue*/ {open:'09:00',close:'20:00'},
         {open:'09:00',close:'20:00'}, {open:'09:00',close:'20:00'}, {open:'09:00',close:'18:00'} ],
```

### Edit any wording (all three languages)
Open the matching `js/translations/*.json`. Find the text (Ctrl+F), change the
part **after** the colon — keep the `{placeholders}` like `{hours}` intact.
The three files must keep the same keys (the site checks this automatically).

### Replace gallery photos
Drop real photos in `img/` and reference them in `index.html` (gallery
section), replacing `img/cut-1.svg` etc. Keep the `loading="lazy"` and
width/height attributes. Replace `img/icon-*.png` for the app icon.

### Google review link
`js/config.js` → `googleReviewsUrl` — paste your real Google review link
(Google Business Profile → "Ask for reviews").

---

## 3. How bookings reach you

- **Online bookings:** you get an alert (WhatsApp and/or email) the moment a
  customer confirms, and the booking appears in the admin table.
- **Customer reminders:** each customer gets a WhatsApp message ~2 hours
  before their appointment, in the language they booked in.
- **WhatsApp requests (Phase 1 channel):** arrive as normal WhatsApp messages
  with service/date/time/name pre-written — answer to confirm.

## 4. Making changes live
Edits to `config.js` / `translations` go live when the site is redeployed
(push to the `main` branch, or press **Deploy** on Netlify). Nothing else to
do. Database-side edits (services in `seed.sql`) need one paste into the
Supabase SQL editor — see MAINTENANCE_GUIDE.md.
