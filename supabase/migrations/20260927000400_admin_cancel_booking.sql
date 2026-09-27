-- Phase 3 Step 4: admin_cancel_booking RPC
-- Allows an admin to cancel a CONFIRMED booking without cancelling the entire trip.

create function public.admin_cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_role('ADMIN');
  v_trip  public.trips := private.lock_trip_of_booking(p_booking_id);
  v_booking public.bookings;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    perform private.raise_error('BOOKING_NOT_FOUND');
  end if;

  if v_booking.status <> 'CONFIRMED' then
    perform private.raise_error('INVALID_TRANSITION',
      format('Only CONFIRMED bookings can be admin-cancelled; this booking is %s', v_booking.status));
  end if;

  update public.bookings
     set status        = 'CANCELLED',
         cancelled_at  = now(),
         cancel_reason = 'ADMIN_CANCELLED',
         cancelled_by  = v_admin
   where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

grant execute on function public.admin_cancel_booking(uuid) to authenticated;
