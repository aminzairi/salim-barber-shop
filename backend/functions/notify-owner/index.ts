// =============================================================================
// EDGE FUNCTION: notify-owner (Deno) — optional instant webhook alternative.
// Supabase Dashboard → Database → Webhooks → on INSERT into `bookings` → POST
// to this function. Sends the owner a WhatsApp/email alert immediately
// (send-reminders stays the safety net via the notifications table).
// Secrets: same as send-reminders.
// =============================================================================

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const payload = await req.json().catch(() => ({}));
  const row = payload.record ?? {};
  const name = row.customer_name ?? '';
  const phone = row.customer_phone ?? '';
  const when = row.start_at ?? '';
  const text = `New booking ${row.ref ?? ''}: ${name} (${phone}) at ${when}.`;

  const token = Deno.env.get('WHATSAPP_TOKEN');
  const phoneId = Deno.env.get('WHATSAPP_PHONE_ID');
  const owner = Deno.env.get('OWNER_PHONE');
  if (token && phoneId && owner) {
    await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: owner.replace('+', ''), type: 'text', text: { body: text } }),
    }).catch((e) => console.error('wa error', e));
  } else {
    console.log('owner notification (provider not configured):', text);
  }
  return new Response('ok');
});
