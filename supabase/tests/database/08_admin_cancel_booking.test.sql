-- Tests for admin_cancel_booking RPC
begin;
create extension if not exists pgtap with schema extensions;
grant execute on all functions in schema extensions to authenticated, anon;
select plan(7);

\set admin  '00000000-0000-4000-a000-000000000001'
\set imran  '00000000-0000-4000-a000-000000000013'
\set neha   '00000000-0000-4000-a000-000000000022'
\set route1 '00000000-0000-4000-d000-000000000001'
\set auto3  '00000000-0000-4000-b000-000000000120'

-- Cancel any existing active trips for Imran first
update public.trips set status = 'CANCELLED', cancel_reason = 'DRIVER_CANCELLED'
 where driver_id = :'imran' and status in ('OPEN', 'BOARDING', 'IN_PROGRESS', 'SUSPENDED');

-- Driver Imran opens a trip
select set_config('request.jwt.claims', jsonb_build_object('sub', :'imran', 'role', 'authenticated')::text, true);
select set_config('role', 'authenticated', true);
select id as trip_id from public.open_trip(:'auto3', :'route1') \gset

-- Passenger Neha books
select set_config('request.jwt.claims', jsonb_build_object('sub', :'neha', 'role', 'authenticated')::text, true);
select id as booking_id from public.book_seats(
  :'trip_id',
  1::smallint,
  'aaaaaaaa-0000-4000-8000-00000000ac01'::uuid
) \gset

-- 1: Booking should be CONFIRMED
select is(
  (select status from bookings where id = :'booking_id'),
  'CONFIRMED',
  'booking starts as CONFIRMED'
);

-- 2: Non-admin (passenger) cannot call admin_cancel_booking
select throws_ok(
  format($$select admin_cancel_booking('%s')$$, :'booking_id'),
  'P0001', null,
  'passenger cannot admin-cancel a booking'
);

-- 3: Non-admin (driver) cannot call admin_cancel_booking
select set_config('request.jwt.claims', jsonb_build_object('sub', :'imran', 'role', 'authenticated')::text, true);
select throws_ok(
  format($$select admin_cancel_booking('%s')$$, :'booking_id'),
  'P0001', null,
  'driver cannot admin-cancel a booking'
);

-- 4-6: Admin cancels the booking
select set_config('request.jwt.claims', jsonb_build_object('sub', :'admin', 'role', 'authenticated')::text, true);
select admin_cancel_booking(:'booking_id');

select is(
  (select status from bookings where id = :'booking_id'),
  'CANCELLED',
  'booking is now CANCELLED'
);

select is(
  (select cancel_reason from bookings where id = :'booking_id'),
  'ADMIN_CANCELLED',
  'cancel reason is ADMIN_CANCELLED'
);

select is(
  (select cancelled_by from bookings where id = :'booking_id'),
  :'admin'::uuid,
  'cancelled_by is the admin'
);

-- 7: Cannot cancel an already cancelled booking
select throws_ok(
  format($$select admin_cancel_booking('%s')$$, :'booking_id'),
  'P0001', null,
  'cannot admin-cancel an already cancelled booking'
);

select * from finish();
rollback;
