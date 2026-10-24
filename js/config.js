/* =============================================================================
 * SHOP CONFIGURATION — THE ONLY FILE THE OWNER NEEDS TO EDIT FOR BUSINESS DATA
 * -----------------------------------------------------------------------------
 * Every value below is a sample placeholder. Replace it with the real shop data.
 * Translations live in js/translations/{en,fr,ar}.json (see docs/MAINTENANCE_GUIDE.md).
 * ========================================================================== */

export const SHOP = {
  /* ---- Identity ---------------------------------------------------------- */
  name: 'Salim Barber Shop',
  nameAr: 'صالون سليم للحلاقة', // shown when the active language is Arabic
  address: '12, Avenue Habib Bourguiba, 1000 Tunis, Tunisia',
  phone: '+21622345678',           // international format, digits only
  phoneDisplay: '+216 22 345 678',
  whatsapp: '21622345678',         // WhatsApp number, digits only, no '+'
  email: 'contact@salimbarber.tn',
  currency: 'TND',                 // prices below are in this currency
  timezone: 'Africa/Tunis',        // ALL booking times are expressed in this zone
  mapUrl: 'https://maps.google.com/?q=12+Avenue+Habib+Bourguiba+Tunis',
  googleReviewsUrl: 'https://g.page/r/salim-barber-shop/review', // TODO: replace with the shop's real Google review link

  /* ---- Opening hours ------------------------------------------------------ */
  /* 0 = Sunday … 6 = Saturday. null = closed. Times are HH:MM in SHOP.timezone. */
  hours: [
    null,                        // Sunday  — closed
    { open: '09:00', close: '20:00' }, // Monday
    { open: '09:00', close: '20:00' }, // Tuesday
    { open: '09:00', close: '20:00' }, // Wednesday
    { open: '09:00', close: '20:00' }, // Thursday
    { open: '09:00', close: '20:00' }, // Friday
    { open: '09:00', close: '20:00' }, // Saturday
  ],

  /* ---- Services ----------------------------------------------------------- */
  /* id is stable — bookings reference it. duration in minutes, price in TND. */
  services: [
    { id: 'haircut',      duration: 30, price: 15 },
    { id: 'beard',        duration: 20, price: 10 },
    { id: 'haircut-beard', duration: 45, price: 22 },
    { id: 'kids',         duration: 25, price: 10 },
  ],

  /* ---- Barbers (set barberChoice=false for a single-chair shop) ----------- */
  barberChoice: true,
  barbers: [
    { id: 'salim',  photo: 'img/barber-salim.svg' },
    { id: 'karim',  photo: 'img/barber-karim.svg' },
    { id: 'yassine', photo: 'img/barber-yassine.svg' },
  ],

  /* ---- Policies ------------------------------------------------------------ */
  paymentMethods: ['cash', 'card'],        // accepted on site (no online payment)
  cancellationWindowHours: 3,              // free cancellation up to N hours before start
  loyalty: { everyNthFree: 10 },           // every Nth haircut is free

  /* ---- Booking engine ------------------------------------------------------ */
  slotStepMinutes: 15,                     // slot grid granularity
  maxAdvanceDays: 30,                      // how far ahead customers can book
  minLeadMinutes: 30,                      // minimum notice before a slot's start

  /* ---- Phase 2 backend (Supabase) ------------------------------------------
   * Fill these in to enable the online booking wizard, reminders and admin panel.
   * Leave them empty to run in DEMO MODE (localStorage fallback, clearly marked).
   * Never put the service-role key here — only the ANON key is safe in the browser. */
  backend: {
    supabaseUrl: '',      // e.g. 'https://xxxx.supabase.co'
    supabaseAnonKey: '',
  },
};

/* Convenience helpers (pure, no DOM) ---------------------------------------- */
export const getService = (id) => SHOP.services.find((s) => s.id === id);
export const getBarber = (id) => SHOP.barbers.find((b) => b.id === id);
export const isClosedDay = (weekday) => SHOP.hours[weekday] == null;
