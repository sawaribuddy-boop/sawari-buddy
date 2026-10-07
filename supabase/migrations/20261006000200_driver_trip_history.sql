-- Driver profile: past trips (completed and cancelled), newest first, cursor-paginated.
-- Uses trips_driver_created_idx (driver_id, created_at desc). Suspended drivers can still read
-- their history, so this checks the DRIVER role only, not an ACTIVE driver record.

create function public.get_driver_trip_history(
  p_limit  integer default 20,
  p_before timestamptz default null   -- pass the last row's created_at for the next page
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_driver uuid := private.require_role('DRIVER');
  v_limit  integer := least(greatest(p_limit, 1), 50);  -- clamp 1..50
begin
  return coalesce((
    select jsonb_agg(row_obj order by created_at desc)
    from (
      select jsonb_build_object(
               'id', t.id,
               'status', t.status,
               'cancel_reason', t.cancel_reason,
               'created_at', t.created_at,
               'started_at', t.started_at,
               'completed_at', t.completed_at,
               'cancelled_at', t.cancelled_at,
               'origin', o.name,
               'destination', d.name,
               'auto_registration', a.registration_number,
               'passenger_count', coalesce(s.passenger_count, 0),
               'seat_count', coalesce(s.seat_count, 0),
               'fare_paise', coalesce(s.fare_paise, 0),
               'platform_fee_paise', coalesce(s.platform_fee_paise, 0)
             ) as row_obj,
             t.created_at
        from public.trips t
        join public.routes r on r.id = t.route_id
        join public.stops o on o.id = r.origin_stop_id
        join public.stops d on d.id = r.destination_stop_id
        join public.autos a on a.id = t.auto_id
        left join lateral (
          select count(*)::integer as passenger_count,
                 sum(b.seat_count)::integer as seat_count,
                 sum(b.total_fare_paise)::bigint as fare_paise,
                 sum(b.platform_fee_paise)::bigint as platform_fee_paise
            from public.bookings b
           where b.trip_id = t.id and b.status = 'COMPLETED'
        ) s on true
       where t.driver_id = v_driver
         and t.status in ('COMPLETED', 'CANCELLED')
         and (p_before is null or t.created_at < p_before)
       order by t.created_at desc, t.id desc
       limit v_limit
    ) sub
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.get_driver_trip_history(integer, timestamptz) from public, anon;
grant execute on function public.get_driver_trip_history(integer, timestamptz) to authenticated;
