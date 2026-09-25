-- SawariBuddy LOCAL DEVELOPMENT seed. Runs on `supabase db reset`. Never run against staging/production.
-- Every seeded account uses the password: SawariDev#2026   (local only)
-- Stop coordinates are approximate points in Noida / Greater Noida West, for development only.

-- ---------------------------------------------------------------------------
-- Auth users (the on_auth_user_created trigger creates PASSENGER profiles)
-- ---------------------------------------------------------------------------
with seed_users (id, email, full_name) as (
  values
    ('00000000-0000-4000-a000-000000000001'::uuid, 'admin@sawaribuddy.local',  'Sawari Admin'),
    ('00000000-0000-4000-a000-000000000011'::uuid, 'raj.kumar@sawaribuddy.local', 'Raj Kumar'),
    ('00000000-0000-4000-a000-000000000012'::uuid, 'suresh@sawaribuddy.local',    'Suresh Yadav'),
    ('00000000-0000-4000-a000-000000000013'::uuid, 'imran@sawaribuddy.local',     'Imran Khan'),
    ('00000000-0000-4000-a000-000000000021'::uuid, 'priya@sawaribuddy.local',     'Priya Sharma'),
    ('00000000-0000-4000-a000-000000000022'::uuid, 'neha@sawaribuddy.local',      'Neha Verma'),
    ('00000000-0000-4000-a000-000000000023'::uuid, 'rahul@sawaribuddy.local',     'Rahul Mehta')
), ins as (
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
         extensions.crypt('SawariDev#2026', extensions.gen_salt('bf')), now(),
         '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', full_name), now(), now(),
         '', '', '', ''
    from seed_users
  returning id, email
)
insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, 'email',
       jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), now(), now(), now()
  from ins;

-- Roles
update public.profiles set role = 'ADMIN'  where id = '00000000-0000-4000-a000-000000000001';
update public.profiles set role = 'DRIVER' where id in ('00000000-0000-4000-a000-000000000011',
                                                        '00000000-0000-4000-a000-000000000012',
                                                        '00000000-0000-4000-a000-000000000013');

-- Drivers (verified) + presence rows (offline)
insert into public.drivers (id, license_number, status, verified_at) values
  ('00000000-0000-4000-a000-000000000011', 'DL0120190001234', 'ACTIVE', now()),
  ('00000000-0000-4000-a000-000000000012', 'DL0120180005678', 'ACTIVE', now()),
  ('00000000-0000-4000-a000-000000000013', 'UP1620200009012', 'ACTIVE', now());
insert into public.driver_presence (driver_id)
select id from public.drivers;

-- ---------------------------------------------------------------------------
-- Fleet
-- ---------------------------------------------------------------------------
insert into public.autos (id, registration_number, capacity, model, colour) values
  ('00000000-0000-4000-b000-000000000102', 'DL01AB1234', 5, 'Bajaj RE', 'Green/Yellow'),
  ('00000000-0000-4000-b000-000000000115', 'DL01AB1115', 5, 'Bajaj RE', 'Green/Yellow'),
  ('00000000-0000-4000-b000-000000000120', 'UP16CD1120', 4, 'Piaggio Ape', 'Green/Yellow');

insert into public.auto_assignments (auto_id, driver_id) values
  ('00000000-0000-4000-b000-000000000102', '00000000-0000-4000-a000-000000000011'),
  ('00000000-0000-4000-b000-000000000115', '00000000-0000-4000-a000-000000000012'),
  ('00000000-0000-4000-b000-000000000120', '00000000-0000-4000-a000-000000000013');

-- ---------------------------------------------------------------------------
-- Network (names from the UI concept)
-- ---------------------------------------------------------------------------
insert into public.stops (id, name, lat, lng) values
  ('00000000-0000-4000-c000-000000000001', 'Station 1 (Metro)', 28.5708, 77.3261),
  ('00000000-0000-4000-c000-000000000002', 'Dream City',        28.6139, 77.4380),
  ('00000000-0000-4000-c000-000000000003', 'Gaur City',         28.6036, 77.4298),
  ('00000000-0000-4000-c000-000000000004', 'Techzone',          28.6187, 77.4232);

insert into public.routes (id, origin_stop_id, destination_stop_id, fare_paise, display_order) values
  ('00000000-0000-4000-d000-000000000001', '00000000-0000-4000-c000-000000000001', '00000000-0000-4000-c000-000000000002', 3000, 1),
  ('00000000-0000-4000-d000-000000000002', '00000000-0000-4000-c000-000000000001', '00000000-0000-4000-c000-000000000003', 2500, 2),
  ('00000000-0000-4000-d000-000000000003', '00000000-0000-4000-c000-000000000001', '00000000-0000-4000-c000-000000000004', 2500, 3),
  ('00000000-0000-4000-d000-000000000004', '00000000-0000-4000-c000-000000000002', '00000000-0000-4000-c000-000000000001', 3000, 4);
