-- Driver goes online without opening a trip (marks presence as online, enables heartbeat).
create function public.go_online()
returns public.driver_presence
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver uuid := private.require_role('DRIVER');
  v_driver_row public.drivers;
  v_presence public.driver_presence;
begin
  select * into v_driver_row from public.drivers where id = v_driver;
  if not found then
    perform private.raise_error('DRIVER_NOT_FOUND', 'Driver record not found');
  end if;
  if v_driver_row.status <> 'ACTIVE' then
    perform private.raise_error('DRIVER_NOT_ACTIVE', 'Only active drivers can go online');
  end if;

  update public.driver_presence
     set is_online = true, last_seen_at = now(), updated_at = now()
   where driver_id = v_driver
  returning * into v_presence;

  return v_presence;
end;
$$;

grant execute on function public.go_online() to authenticated;
