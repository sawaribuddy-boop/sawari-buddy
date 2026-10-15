-- Drivers see their average rating and are told when a new rating arrives.
--
-- * get_my_driver_rating(): average stars (1 decimal), how many ratings, and how many of each star.
--   Still no comments or passenger names: on a small trip they could identify who rated.
-- * A new rating is broadcast as `rating_received` on the driver's own private channel
--   driver:<driver_id> (only that driver may join), with the stars and the new average.

create function public.get_my_driver_rating()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_driver uuid := private.require_role('DRIVER');
begin
  return (
    select jsonb_build_object(
             'average', round(avg(rr.stars), 1),
             'count', count(*)::integer,
             'by_stars', jsonb_build_object(
               '5', count(*) filter (where rr.stars = 5)::integer,
               '4', count(*) filter (where rr.stars = 4)::integer,
               '3', count(*) filter (where rr.stars = 3)::integer,
               '2', count(*) filter (where rr.stars = 2)::integer,
               '1', count(*) filter (where rr.stars = 1)::integer))
      from public.ride_ratings rr
     where rr.driver_id = v_driver);
end;
$$;

revoke execute on function public.get_my_driver_rating() from public, anon;
grant execute on function public.get_my_driver_rating() to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: driver:<id> is a private channel only that driver can receive on.
-- ---------------------------------------------------------------------------
create function private.can_join_driver_channel(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_topic = 'driver:' || (select auth.uid())::text;
$$;

-- Referenced from an RLS policy, so the querying role must be able to run it.
grant execute on function private.can_join_driver_channel(text) to authenticated;

create policy driver_channel_receive on realtime.messages for select to authenticated
  using (realtime.messages.extension = 'broadcast' and private.can_join_driver_channel((select realtime.topic())));

create function private.ride_ratings_broadcast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_average numeric;
  v_count integer;
begin
  select round(avg(stars), 1), count(*) into v_average, v_count
    from public.ride_ratings where driver_id = new.driver_id;
  perform private.broadcast('driver:' || new.driver_id, 'rating_received',
    jsonb_build_object('stars', new.stars, 'average', v_average, 'count', v_count));
  return null;
end;
$$;

create trigger ride_ratings_broadcast after insert on public.ride_ratings
  for each row execute function private.ride_ratings_broadcast();
