-- In-app account deletion (required by the App Store and Google Play).
--
-- Bookings, ratings, issues and the append-only ledger reference the profile, and drivers'
-- earnings depend on booking history, so the account is anonymised rather than removed:
--   * profile: name becomes 'Deleted user', email and phone cleared, status SUSPENDED
--   * driver: suspended, auto assignments revoked, presence and last location cleared
--   * rating comments removed (stars stay with the trip)
--   * login removed: identities and sessions deleted, the auth user scrubbed and banned,
--     which frees the email for a new sign-up
-- Refused while the caller has an active booking or trip, or a driver has an unsettled balance.

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_profile public.profiles;
  v_balance bigint;
begin
  if v_uid is null then
    perform private.raise_error('NOT_AUTHORISED');
  end if;
  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then
    perform private.raise_error('USER_NOT_FOUND');
  end if;
  if v_profile.role = 'ADMIN' then
    perform private.raise_error('NOT_AUTHORISED', 'Admin accounts are removed by another admin');
  end if;

  if exists (select 1 from public.bookings where passenger_id = v_uid and status in ('CONFIRMED', 'BOARDED')) then
    perform private.raise_error('ACTIVE_BOOKING_EXISTS');
  end if;

  if v_profile.role = 'DRIVER' then
    if exists (select 1 from public.trips
                where driver_id = v_uid and status in ('OPEN', 'BOARDING', 'IN_PROGRESS', 'SUSPENDED')) then
      perform private.raise_error('ACTIVE_TRIP_EXISTS');
    end if;
    select coalesce(sum(e.amount_paise), 0) into v_balance
      from public.ledger_accounts a
      join public.ledger_entries e on e.account_id = a.id
     where a.owner_profile_id = v_uid;
    if v_balance <> 0 then
      perform private.raise_error('SETTLEMENT_PENDING', format('Unsettled balance of %s paise', v_balance));
    end if;

    update public.drivers set status = 'SUSPENDED' where id = v_uid;
    update public.auto_assignments set revoked_at = now() where driver_id = v_uid and revoked_at is null;
    update public.driver_presence
       set is_online = false, active_trip_id = null, lat = null, lng = null, accuracy_m = null,
           location_at = null, updated_at = now()
     where driver_id = v_uid;
  end if;

  update public.profiles
     set full_name = 'Deleted user', email = null, phone = null, status = 'SUSPENDED'
   where id = v_uid;
  update public.ride_ratings set comment = null where passenger_id = v_uid;

  delete from auth.identities where user_id = v_uid;
  delete from auth.sessions where user_id = v_uid;
  delete from auth.refresh_tokens where user_id = v_uid::text;
  update auth.users
     set email = null, phone = null, encrypted_password = null,
         raw_user_meta_data = '{}'::jsonb, banned_until = 'infinity', deleted_at = now()
   where id = v_uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
