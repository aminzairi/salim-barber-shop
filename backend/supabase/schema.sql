-- =============================================================================
-- SALIM BARBER SHOP — SUPABASE SCHEMA (Phase 2)
-- Run in Supabase SQL editor (or supabase db push). Idempotent.
--
-- Concurrency / double-booking strategy (FR-03):
--   1. EXCLUDE constraint (GiST, btree_gist): no two active bookings/blocks for
--      the same barber may overlap in time — enforced by the DATABASE, not app
--      code. Even a buggy client cannot double-book.
--   2. create_booking() takes a transaction-scoped advisory lock per
--      (barber, date) so the "find a free barber" check and the INSERT are
--      atomic: two simultaneous "any barber" requests cannot both pick the
--      same chair. The loser hits the exclusion constraint → SLOT_TAKEN.
--   3. All times stored as timestamptz built from Africa/Tunis wall-clock
--      strings the client sends ("YYYY-MM-DD", "HH:MM").
-- =============================================================================

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- ---------- Enum & tables ----------------------------------------------------

do $$ begin
  create type booking_status as enum ('booked', 'cancelled', 'blocked', 'completed');
exception when duplicate_object then null; end $$;

create table if not exists services (
  id            text primary key,            -- stable id used by the frontend config
  name_en       text not null,
  name_fr       text not null,
  name_ar       text not null,
  duration_min  int  not null check (duration_min between 5 and 240),
  price_tnd     numeric(6,2) not null check (price_tnd >= 0),
  active        boolean not null default true
);

create table if not exists barbers (
  id        text primary key,
  name_en   text not null,
  name_fr   text not null,
  name_ar   text not null,
  active    boolean not null default true
);

create table if not exists bookings (
  id             uuid primary key default gen_random_uuid(),
  ref            text not null unique,       -- public reference (SB-XXXXXX)
  service_id     text references services(id),
  barber_id      text not null references barbers(id),
  start_at       timestamptz not null,
  end_at         timestamptz not null,
  customer_name  text not null check (char_length(customer_name) between 3 and 80),
  customer_phone text not null check (customer_phone ~ '^\+216[2459]\d{7}$'),
  customer_email text check (customer_email is null or customer_email ~ '^[^@]+@[^@]+\.[^@]{2,}$'),
  note           text check (note is null or char_length(note) <= 500),
  locale         text not null default 'fr' check (locale in ('en','fr','ar')),
  status         booking_status not null default 'booked',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists walk_in_status (
  id           smallint primary key default 1 check (id = 1),
  waiting      int not null default 0 check (waiting between 0 and 99),
  eta_minutes  int not null default 0 check (eta_minutes between 0 and 480),
  updated_at   timestamptz not null default now()
);
insert into walk_in_status (id) values (1) on conflict (id) do nothing;

create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- Notification queue: owner alerts + customer reminders, drained by the
-- scheduled Edge Function backend/functions/send-reminders.
create table if not exists notifications (
  id          bigserial primary key,
  kind        text not null check (kind in ('owner_new_booking', 'customer_reminder', 'owner_cancelled')),
  booking_id  uuid references bookings(id) on delete cascade,
  recipient   text not null,                 -- phone (WhatsApp) or email address
  locale      text not null default 'fr',
  payload     jsonb not null default '{}',
  due_at      timestamptz not null default now(),
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- ---------- THE double-booking guard -----------------------------------------
alter table bookings
  add constraint bookings_no_overlap
  exclude using gist (
    barber_id with =,
    tstzrange(start_at, end_at) with &&
  ) where (status in ('booked', 'blocked'));
-- (Idempotency: guarded by the DO block below in re-runs.)

create index if not exists bookings_start_idx    on bookings (start_at);
create index if not exists bookings_barber_idx   on bookings (barber_id, start_at);
create index if not exists bookings_phone_idx    on bookings (customer_phone);
create index if not exists notifications_due_idx on notifications (due_at) where sent_at is null;

-- Re-add exclusion constraint if it was dropped (manual repair path).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_no_overlap') then
    alter table bookings add constraint bookings_no_overlap
      exclude using gist (barber_id with =, tstzrange(start_at, end_at) with &&)
      where (status in ('booked', 'blocked'));
  end if;
end $$;

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists bookings_touch on bookings;
create trigger bookings_touch before update on bookings
  for each row execute function touch_updated_at();

-- ---------- Helpers ------------------------------------------------------------

-- Human-readable reference: SB-XXXXXX from a 32-char alphabet without I,L,O,0,1.
create or replace function sb_ref() returns text
language sql volatile as $$
  select 'SB-' || (
    select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789',
                             1 + floor(random() * 31)::int, 1)
             from generate_series(1, 6))
  ) $$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid()) $$;

-- ---------- RLS ------------------------------------------------------------------
alter table bookings      enable row level security;
alter table notifications enable row level security;
alter table walk_in_status enable row level security;
alter table services      enable row level security;
alter table barbers       enable row level security;

-- Public catalog reads (needed to render the wizard).
drop policy if exists services_public_read on services;
create policy services_public_read on services for select using (active);
drop policy if exists barbers_public_read on barbers;
create policy barbers_public_read on barbers for select using (active);

-- bookings: NO direct anon access — create_booking/cancel_booking RPCs only.
-- Admins get full row access.
drop policy if exists bookings_admin_all on bookings;
create policy bookings_admin_all on bookings
  for all using (is_admin()) with check (is_admin());

drop policy if exists walkin_public_read on walk_in_status;
create policy walkin_public_read on walk_in_status for select using (true);
drop policy if exists walkin_admin_write on walk_in_status;
create policy walkin_admin_write on walk_in_status for update using (is_admin());

drop policy if exists notifications_admin on notifications;
create policy notifications_admin on notifications for select using (is_admin());

-- Admin-facing listing (view owned by postgres; is_admin() keeps data private).
create or replace view bookings_view as
  select b.ref, b.service_id, b.barber_id,
         (b.start_at at time zone 'Africa/Tunis')::date  as booking_date,
         to_char(b.start_at at time zone 'Africa/Tunis', 'HH24:MI') as start_time,
         to_char(b.end_at   at time zone 'Africa/Tunis', 'HH24:MI') as end_time,
         b.customer_name as name, b.customer_phone as phone, b.customer_email as email,
         b.note, b.locale as lang, b.status, b.created_at, b.id
  from bookings b
  where is_admin();
grant select on bookings_view to anon, authenticated;

-- ---------- Public RPCs ------------------------------------------------------------

-- Busy intervals for a date (slot grid rendering). Times are shop-local HH:MM.
create or replace function busy_intervals(p_date date)
returns table (start text, "end" text, barber_id text, status booking_status)
language sql stable security definer set search_path = public as $$
  select to_char(b.start_at at time zone 'Africa/Tunis', 'HH24:MI'),
         to_char(b.end_at   at time zone 'Africa/Tunis', 'HH24:MI'),
         b.barber_id, b.status
  from bookings b
  where b.status in ('booked', 'blocked')
    and (b.start_at at time zone 'Africa/Tunis')::date = p_date
$$;

-- Availability grid for one service/date/barber — SQL mirror of js/slots.js.
create or replace function available_slots(p_service_id text, p_date date, p_barber_id text default null)
returns table (slot text, free_barbers text[])
language plpgsql stable security definer set search_path = public as $$
declare
  s record; step_min int := 15; open_min int; close_min int; dur int; wd int;
  day_open time; day_close time; hours jsonb := $json$[
    null, {"open":"09:00","close":"20:00"},{"open":"09:00","close":"20:00"},
    {"open":"09:00","close":"20:00"},{"open":"09:00","close":"20:00"},
    {"open":"09:00","close":"20:00"},{"open":"09:00","close":"20:00"}]$json$::jsonb;
begin
  select duration_min into dur from services where id = p_service_id and active;
  if dur is null then return; end if;
  wd := extract(dow from p_date);
  if hours->wd is null then return; end if;
  day_open  := (hours->wd->>'open')::time;
  day_close := (hours->wd->>'close')::time;

  for s in
    select to_char(gs, 'HH24:MI') as slot
    from generate_series(day_open, day_close - make_interval(mins => dur), make_interval(mins => step_min)) gs
  loop
    slot := s.slot;
    free_barbers := array(
      select br.id from barbers br
      where br.active
        and (p_barber_id is null or p_barber_id = 'any' or br.id = p_barber_id)
        and not exists (
          select 1 from bookings b
          where b.barber_id = br.id and b.status in ('booked','blocked')
            and (b.start_at at time zone 'Africa/Tunis')::date = p_date
            and tstzrange(b.start_at, b.end_at) &&
                tstzrange((p_date + s.slot::time) at time zone 'Africa/Tunis',
                          (p_date + s.slot::time + make_interval(mins => dur)) at time zone 'Africa/Tunis'))
      order by br.id);
    if array_length(free_barbers, 1) > 0 then return next; end if;
  end loop;
end $$;

-- Create a booking. Atomic; raises SLOT_TAKEN on conflict. Anon-callable.
create or replace function create_booking(
  p_service_id text, p_barber_id text, p_date date, p_start time,
  p_name text, p_phone text, p_email text default null, p_note text default null,
  p_locale text default 'fr'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_dur int; v_barber text; v_end timestamptz; v_start timestamptz;
  v_ref text; v_id uuid; v_free text[];
  v_window_hours int := 3;     -- free cancellation window (matches config.js)
begin
  -- Light anti-spam: same phone cannot hold more than 3 future bookings.
  if (select count(*) from bookings
      where customer_phone = p_phone and status = 'booked' and start_at > now()) >= 3 then
    raise exception 'TOO_MANY_ACTIVE' using errcode = 'P0001';
  end if;

  select duration_min into v_dur from services where id = p_service_id and active;
  if v_dur is null then raise exception 'BAD_SERVICE' using errcode = 'P0001'; end if;

  v_start := (p_date + p_start) at time zone 'Africa/Tunis';
  v_end   := v_start + make_interval(mins => v_dur);
  if v_start <= now() + interval '20 minutes' then
    raise exception 'SLOT_PAST' using errcode = 'P0001';
  end if;

  -- Candidate barbers (explicit or all active), least-loaded first.
  with wanted as (
    select id from barbers
    where active and (p_barber_id is null or p_barber_id = 'any' or id = p_barber_id)
  )
  select array(
    select w.id from wanted w
    where not exists (
      select 1 from bookings b
      where b.barber_id = w.id and b.status in ('booked','blocked')
        and tstzrange(b.start_at, b.end_at) && tstzrange(v_start, v_end))
  ) into v_free;
  if v_free is null or array_length(v_free, 1) is null then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end if;

  -- Serialize concurrent attempts per barber+date; loser violates the
  -- exclusion constraint below and surfaces as SLOT_TAKEN.
  perform pg_advisory_xact_lock(hashtext(v_free[1] || p_date::text));

  v_barber := v_free[1];
  v_start  := (p_date + p_start) at time zone 'Africa/Tunis';
  v_end    := v_start + make_interval(mins => v_dur);
  v_ref    := sb_ref();

  begin
    insert into bookings (ref, service_id, barber_id, start_at, end_at,
                          customer_name, customer_phone, customer_email, note, locale)
    values (v_ref, p_service_id, v_barber, v_start, v_end,
            btrim(p_name), p_phone, p_email, p_note, p_locale)
    returning id, ref into v_id, v_ref;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end;

  -- Owner notification (drained by the send-reminders function).
  insert into notifications (kind, booking_id, recipient, locale, payload)
  values ('owner_new_booking', v_id, 'owner', p_locale,
          jsonb_build_object('name', btrim(p_name), 'phone', p_phone,
                             'service', p_service_id, 'date', p_date::text,
                             'time', to_char(p_start, 'HH24:MI'), 'ref', v_ref));

  -- Customer reminder ~2h before start.
  insert into notifications (kind, booking_id, recipient, locale, due_at, payload)
  values ('customer_reminder', v_id, p_phone, p_locale, v_start - interval '2 hours',
          jsonb_build_object('name', btrim(p_name), 'ref', v_ref,
                             'service', p_service_id, 'date', p_date::text,
                             'time', to_char(p_start, 'HH24:MI')));

  return jsonb_build_object('ref', v_ref, 'serviceId', p_service_id, 'barberId', v_barber,
                            'date', p_date::text, 'start', to_char(p_start, 'HH24:MI'),
                            'end', to_char(p_start + make_interval(mins => v_dur), 'HH24:MI'),
                            'status', 'booked');
end $$;

-- Public lookup by reference (ref acts as a bearer capability).
create or replace function get_booking(p_ref text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ref', b.ref, 'serviceId', b.service_id, 'barberId', b.barber_id,
    'date', (b.start_at at time zone 'Africa/Tunis')::text,
    'start', to_char(b.start_at at time zone 'Africa/Tunis', 'HH24:MI'),
    'status', b.status, 'name', b.customer_name)
  from bookings b
  where upper(b.ref) = upper(p_ref) and b.status in ('booked','cancelled')
$$;

-- Cancel by reference. Customers: only before the policy window closes.
create or replace function cancel_booking(p_ref text, p_force boolean default false)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_start timestamptz; v_id uuid;
begin
  select start_at, id into v_start, v_id from bookings
  where upper(ref) = upper(p_ref) and status = 'booked';
  if v_id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if not p_force and not is_admin() and v_start - now() < interval '3 hours' then
    raise exception 'CANCEL_WINDOW_EXPIRED' using errcode = 'P0001';
  end if;
  update bookings set status = 'cancelled' where id = v_id;
  return jsonb_build_object('ok', true);
end $$;

-- Reschedule = guarded move (keeps the same barber unless told otherwise).
create or replace function reschedule_booking(
  p_ref text, p_date date, p_start time, p_barber_id text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b record; v_start timestamptz; v_end timestamptz; v_barber text;
begin
  select * into b from bookings where upper(ref) = upper(p_ref) and status = 'booked';
  if b.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if b.start_at - now() < interval '3 hours' then
    raise exception 'CANCEL_WINDOW_EXPIRED' using errcode = 'P0001';
  end if;
  v_start  := (p_date + p_start) at time zone 'Africa/Tunis';
  v_end    := v_start + make_interval(mins => (select duration_min from services where id = b.service_id));
  v_barber := coalesce(p_barber_id, b.barber_id);
  perform pg_advisory_xact_lock(hashtext(v_barber || p_date::text));
  begin
    update bookings set start_at = v_start, end_at = v_end, barber_id = v_barber where id = b.id;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end;
  return jsonb_build_object('ok', true, 'ref', b.ref);
end $$;

-- ---------- Admin-only RPCs ----------------------------------------------------

create or replace function block_slot(
  p_date date, p_start time, p_end time, p_barber_id text, p_reason text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_ref text;
begin
  if not is_admin() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  v_ref := sb_ref();
  insert into bookings (ref, service_id, barber_id, start_at, end_at,
                        customer_name, customer_phone, note, status)
  values (v_ref, null, p_barber_id,
          (p_date + p_start) at time zone 'Africa/Tunis',
          (p_date + p_end)   at time zone 'Africa/Tunis',
          'BLOCKED', '+21620000000', p_reason, 'blocked');
  return jsonb_build_object('ok', true, 'ref', v_ref);
end $$;

create or replace function update_walk_in(p_waiting int, p_eta_minutes int)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  update walk_in_status set waiting = p_waiting, eta_minutes = p_eta_minutes, updated_at = now()
    where id = 1 returning waiting, eta_minutes, updated_at;
  return jsonb_build_object('ok', true);
end $$;

-- Reminders due now (called by the scheduled Edge Function).
create or replace function due_notifications(p_limit int default 25)
returns setof notifications
language sql stable security definer set search_path = public as $$
  select * from notifications
  where sent_at is null and due_at <= now()
  order by due_at
  limit p_limit
$$;

create or replace function mark_notification_sent(p_id bigint)
returns void
language sql security definer set search_path = public as $$
  update notifications set sent_at = now() where id = p_id
$$;

-- ---------- Grants ---------------------------------------------------------------
grant execute on function public.busy_intervals(date)                  to anon, authenticated;
grant execute on function public.available_slots(text, date, text)     to anon, authenticated;
grant execute on function public.create_booking(text, text, date, time, text, text, text, text, text) to anon, authenticated;
grant execute on function public.get_booking(text)                     to anon, authenticated;
grant execute on function public.cancel_booking(text, boolean)         to anon, authenticated;
grant execute on function public.reschedule_booking(text, date, time, text) to anon, authenticated;
-- block_slot / update_walk_in / due_notifications: authenticated admins only.
