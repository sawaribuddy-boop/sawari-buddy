-- Pre-sign-in health check: callable by anon, returns no data beyond server time.
begin;
create extension if not exists pgtap with schema extensions;
grant execute on all functions in schema extensions to authenticated, anon;
select no_plan();

set local role anon;
select is((public.get_server_status() ->> 'ok')::boolean, true, 'anon can call get_server_status');
select ok((public.get_server_status() ->> 'server_time')::timestamptz is not null, 'returns the server time');
select is((select array_agg(k order by k) from jsonb_object_keys(public.get_server_status()) k),
          array['ok', 'server_time', 'service'], 'returns only ok, service and server_time');
select throws_ok('select count(*) from public.trips', '42501', null, 'anon still cannot read tables');
select throws_ok(format('select public.search_trips(%L, %L)', gen_random_uuid(), gen_random_uuid()), '42501', null,
                 'anon still cannot call business RPCs');

reset role;
set local role authenticated;
select is((public.get_server_status() ->> 'ok')::boolean, true, 'signed-in users can call it too');

select * from finish();
rollback;
