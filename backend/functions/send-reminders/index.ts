// =============================================================================
// EDGE FUNCTION: send-reminders (Deno, Supabase Edge Runtime).
// Scheduled every 10 minutes from the Supabase Dashboard → Integrations →
// Cron (or pg_cron hitting the function URL with the service role key).
//
// Drains the `notifications` queue:
//   - customer_reminder  → WhatsApp (Meta Cloud API) in the customer's locale,
//                          sent ~2h before the appointment.
//   - owner_new_booking  → owner alert by email (Resend) or WhatsApp.
// Set secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//              WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, OWNER_PHONE, OWNER_EMAIL,
//              RESEND_API_KEY (all optional — missing providers are skipped).
// =============================================================================

const MESSAGES = {
  en: {
    reminder: (n) => `Hi ${n.name}! Reminder: your appointment at ${n.shop} is today at ${n.time} (ref ${n.ref}). Reply here to cancel or reschedule.`,
    owner: (n) => `New booking ${n.ref}: ${n.name} (${n.phone}) — ${n.service} on ${n.date} at ${n.time}.`,
  },
  fr: {
    reminder: (n) => `Bonjour ${n.name} ! Rappel : votre rendez-vous chez ${n.shop} est aujourd'hui à ${n.time} (réf ${n.ref}). Répondez ici pour annuler ou reporter.`,
    owner: (n) => `Nouvelle réservation ${n.ref} : ${n.name} (${n.phone}) — ${n.service} le ${n.date} à ${n.time}.`,
  },
  ar: {
    reminder: (n) => `مرحباً ${n.name}! تذكير: موعدك في ${n.shop} اليوم على الساعة ${n.time} (المرجع ${n.ref}). رد هنا للإلغاء أو التغيير.`,
    owner: (n) => `حجز جديد ${n.ref}: ${n.name} (${n.phone}) — ${n.service} يوم ${n.date} على الساعة ${n.time}.`,
  },
};
const SERVICE_NAMES = {
  haircut: { en: 'Haircut', fr: 'Coupe', ar: 'قصة شعر' },
  beard: { en: 'Beard trim', fr: 'Taille de barbe', ar: 'تشذيب اللحية' },
  'haircut-beard': { en: 'Haircut + beard', fr: 'Coupe + barbe', ar: 'قصة شعر + لحية' },
  kids: { en: 'Kids haircut', fr: 'Coupe enfant', ar: 'قصة شعر للأطفال' },
};
const SHOP = { en: 'Salim Barber Shop', fr: 'Salim Barber Shop', ar: 'صالون سليم للحلاقة' };

async function sendWhatsApp(to, text) {
  const token = Deno.env.get('WHATSAPP_TOKEN');
  const phoneId = Deno.env.get('WHATSAPP_PHONE_ID');
  if (!token || !phoneId || !to?.startsWith('+')) return false; // provider off / owner pseudo-address
  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: to.replace('+', ''), type: 'text', text: { body: text } }),
  });
  if (!res.ok) console.error('WhatsApp send failed', res.status, await res.text());
  return res.ok;
}

async function sendOwnerEmail(text) {
  const key = Deno.env.get('RESEND_API_KEY');
  const to = Deno.env.get('OWNER_EMAIL');
  if (!key || !to) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'bookings@salimbarber.tn', to: [to], subject: 'New booking', text }),
  });
  return res.ok;
}

Deno.serve(async () => {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const sb = (path) => fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });

  const due = await (await sb('rpc/due_notifications?limit=25')).json();
  let sent = 0;
  for (const n of due ?? []) {
    const locale = MESSAGES[n.locale] ? n.locale : 'fr';
    const p = n.payload ?? {};
    const ctx = { ...p, shop: SHOP[locale], service: SERVICE_NAMES[p.service]?.[locale] ?? p.service ?? '' };
    let ok = false;
    try {
      if (n.kind === 'customer_reminder') {
        ok = await sendWhatsApp(n.recipient, MESSAGES[locale].reminder(ctx));
      } else if (n.kind === 'owner_new_booking') {
        ok = (await sendWhatsApp(Deno.env.get('OWNER_PHONE') ?? '', MESSAGES[locale].owner(ctx)))
          || (await sendOwnerEmail(MESSAGES[locale].owner(ctx)));
      } else {
        ok = true; // unknown kinds are drained to avoid clogging the queue
      }
    } catch (e) {
      console.error('notification error', e);
    }
    if (ok || n.due_at < new Date(Date.now() - 3600_000).toISOString()) {
      // mark sent on success, or if retried for >1h (poison-pill guard)
      await sb(`rpc/mark_notification_sent?p_id=${n.id}`).post().catch(() => {});
      sent += 1;
    }
  }
  return new Response(JSON.stringify({ processed: due?.length ?? 0, sent }), { headers: { 'Content-Type': 'application/json' } });
});
