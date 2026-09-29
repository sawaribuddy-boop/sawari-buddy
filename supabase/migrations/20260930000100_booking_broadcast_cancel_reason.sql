-- Include cancel_reason in booking_changed broadcasts so apps can tell who cancelled a booking
-- (passenger, driver's trip cancel, unreachable sweep, admin) and notify the other side.
create or replace function private.bookings_broadcast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip public.trips;
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    select * into v_trip from public.trips where id = new.trip_id;
    perform private.broadcast('trip:' || new.trip_id, 'booking_changed',
      jsonb_build_object('trip_id', new.trip_id, 'booking_id', new.id, 'source', new.source,
                         'status', new.status, 'seat_count', new.seat_count,
                         'cancel_reason', new.cancel_reason,
                         'available_seats', v_trip.capacity - private.trip_occupied_seats(new.trip_id)));
  end if;
  return null;
end;
$$;
