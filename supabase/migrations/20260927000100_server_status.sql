-- SawariBuddy: minimal, data-free health check callable before sign-in.
--
-- Used by the mobile app's development connection diagnostics to prove the phone reaches the
-- database through the API, and later to measure phone-vs-server clock skew (countdowns such as
-- the no-show grace period must be based on server time). Exposes no table data and no versions.

create function public.get_server_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('ok', true, 'service', 'sawari-buddy', 'server_time', now());
$$;

revoke execute on function public.get_server_status() from public;
grant execute on function public.get_server_status() to anon, authenticated;
