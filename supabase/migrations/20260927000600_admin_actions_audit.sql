-- Phase 3 Step 7: admin_actions audit table
-- Records every significant admin action for traceability.

create table public.admin_actions (
  id          bigint generated always as identity primary key,
  admin_id    uuid not null references public.profiles(id),
  action      text not null,
  target_type text,
  target_id   text,
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index admin_actions_admin_id_idx on public.admin_actions (admin_id);
create index admin_actions_created_at_idx on public.admin_actions (created_at desc);

alter table public.admin_actions enable row level security;

create policy admin_actions_admin_read on public.admin_actions
  for select to authenticated
  using (private.is_admin());

create policy admin_actions_admin_insert on public.admin_actions
  for insert to authenticated
  with check (private.is_admin() and admin_id = auth.uid());

grant select, insert on public.admin_actions to authenticated;
