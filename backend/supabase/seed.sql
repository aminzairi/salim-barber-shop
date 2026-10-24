-- =============================================================================
-- SEED DATA — services & barbers must mirror js/config.js exactly.
-- Create the admin user FIRST in Supabase → Authentication → Users, then:
--   insert into admins (user_id) values ('<auth-user-uuid>');
-- =============================================================================

insert into services (id, name_en, name_fr, name_ar, duration_min, price_tnd) values
  ('haircut',       'Haircut',         'Coupe',            'قصة شعر',            30, 15.00),
  ('beard',         'Beard trim',      'Taille de barbe',  'تشذيب اللحية',       20, 10.00),
  ('haircut-beard', 'Haircut + beard', 'Coupe + barbe',    'قصة شعر + لحية',     45, 22.00),
  ('kids',          'Kids haircut',    'Coupe enfant',     'قصة شعر للأطفال',    25, 10.00)
on conflict (id) do update set duration_min = excluded.duration_min, price_tnd = excluded.price_tnd;

insert into barbers (id, name_en, name_fr, name_ar) values
  ('salim',   'Salim',   'Salim',   'سليم'),
  ('karim',   'Karim',   'Karim',   'كريم'),
  ('yassine', 'Yassine', 'Yassine', 'ياسين')
on conflict (id) do nothing;

-- Optional: clean up past bookings (data minimisation, Organic Law 2004-63).
-- Run monthly via pg_cron:
--   select cron.schedule('purge-old-bookings', '0 3 * * *',
--     $$delete from bookings where start_at < now() - interval '6 months'$$);
