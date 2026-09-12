-- Signed-in personal workspace persistence for Digi Math Pad.
-- Run after 202609090001_classroom_foundation.sql.

begin;

create table public.personal_workspaces (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  content jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personal_workspaces_content_object check (jsonb_typeof(content) = 'object'),
  constraint personal_workspaces_content_size check (pg_column_size(content) <= 5242880)
);

create trigger personal_workspaces_set_updated_at
before update on public.personal_workspaces
for each row execute function private.set_updated_at();

alter table public.personal_workspaces enable row level security;

revoke all on table public.personal_workspaces from anon, authenticated;
grant select, insert, update, delete on table public.personal_workspaces to authenticated;

create policy personal_workspaces_select_self
on public.personal_workspaces for select to authenticated
using (user_id = (select auth.uid()));

create policy personal_workspaces_insert_self
on public.personal_workspaces for insert to authenticated
with check (user_id = (select auth.uid()));

create policy personal_workspaces_update_self
on public.personal_workspaces for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy personal_workspaces_delete_self
on public.personal_workspaces for delete to authenticated
using (user_id = (select auth.uid()));

comment on table public.personal_workspaces is
  'Private cross-device practice and working-document library for each signed-in user.';

commit;
