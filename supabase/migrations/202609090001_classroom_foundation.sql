-- Digi Math Pad classroom foundation.
-- Run once in a new Supabase project. All browser-accessible tables use RLS.

begin;

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public;

create type public.user_role as enum ('student', 'teacher');
create type public.assignment_status as enum ('draft', 'published', 'closed');
create type public.submission_status as enum ('draft', 'submitted', 'returned');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 100),
  role public.user_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  join_code text not null default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint courses_join_code_unique unique (join_code),
  constraint courses_join_code_format check (join_code ~ '^[A-F0-9]{8}$')
);

create table public.course_members (
  course_id uuid not null references public.courses (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (course_id, student_id)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 160),
  instructions text not null default '',
  content jsonb not null default '{"blocks": []}'::jsonb,
  status public.assignment_status not null default 'draft',
  due_at timestamptz,
  allow_resubmission boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assignments_content_object check (jsonb_typeof(content) = 'object'),
  constraint assignments_content_size check (pg_column_size(content) <= 1048576)
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  content jsonb not null default '{"blocks": []}'::jsonb,
  status public.submission_status not null default 'draft',
  feedback text not null default '',
  submitted_at timestamptz,
  returned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint submissions_one_per_student unique (assignment_id, student_id),
  constraint submissions_content_object check (jsonb_typeof(content) = 'object'),
  constraint submissions_content_size check (pg_column_size(content) <= 1048576)
);

create index course_members_student_idx on public.course_members (student_id);
create index assignments_course_status_idx on public.assignments (course_id, status);
create index submissions_student_idx on public.submissions (student_id, updated_at desc);
create index submissions_assignment_idx on public.submissions (assignment_id, status);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger courses_set_updated_at
before update on public.courses
for each row execute function private.set_updated_at();

create trigger assignments_set_updated_at
before update on public.assignments
for each row execute function private.set_updated_at();

create trigger submissions_set_updated_at
before update on public.submissions
for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role public.user_role;
  requested_name text;
begin
  requested_role := case
    when new.raw_user_meta_data ->> 'role' = 'teacher' then 'teacher'::public.user_role
    else 'student'::public.user_role
  end;
  requested_name := left(
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'New user'
    ),
    100
  );

  insert into public.profiles (id, display_name, role)
  values (new.id, requested_name, requested_role);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

revoke all on function private.set_updated_at() from public;
revoke all on function private.handle_new_user() from public;

create or replace function private.is_teacher()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'teacher'
  );
$$;

create or replace function private.is_course_teacher(target_course_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.courses c
    where c.id = target_course_id and c.teacher_id = (select auth.uid())
  );
$$;

create or replace function private.is_course_member(target_course_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.course_members m
    where m.course_id = target_course_id and m.student_id = (select auth.uid())
  );
$$;

create or replace function private.can_manage_assignment(target_assignment_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.assignments a
    join public.courses c on c.id = a.course_id
    where a.id = target_assignment_id and c.teacher_id = (select auth.uid())
  );
$$;

create or replace function private.can_view_profile(target_profile_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select
    target_profile_id = (select auth.uid())
    or exists (
      select 1
      from public.course_members m
      join public.courses c on c.id = m.course_id
      where
        (c.teacher_id = (select auth.uid()) and m.student_id = target_profile_id)
        or (c.teacher_id = target_profile_id and m.student_id = (select auth.uid()))
    );
$$;

revoke all on function private.is_teacher() from public;
revoke all on function private.is_course_teacher(uuid) from public;
revoke all on function private.is_course_member(uuid) from public;
revoke all on function private.can_manage_assignment(uuid) from public;
revoke all on function private.can_view_profile(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_teacher() to authenticated;
grant execute on function private.is_course_teacher(uuid) to authenticated;
grant execute on function private.is_course_member(uuid) to authenticated;
grant execute on function private.can_manage_assignment(uuid) to authenticated;
grant execute on function private.can_view_profile(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_members enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.courses from anon, authenticated;
revoke all on table public.course_members from anon, authenticated;
revoke all on table public.assignments from anon, authenticated;
revoke all on table public.submissions from anon, authenticated;

grant usage on type public.user_role to authenticated;
grant usage on type public.assignment_status to authenticated;
grant usage on type public.submission_status to authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;
grant select, insert, update, delete on table public.courses to authenticated;
grant select, delete on table public.course_members to authenticated;
grant select, insert, update, delete on table public.assignments to authenticated;
grant select on table public.submissions to authenticated;

create policy profiles_select_related
on public.profiles for select to authenticated
using (private.can_view_profile(id));

create policy profiles_update_self
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy courses_select_participating
on public.courses for select to authenticated
using (
  teacher_id = (select auth.uid())
  or private.is_course_member(id)
);

create policy courses_insert_teacher
on public.courses for insert to authenticated
with check (
  teacher_id = (select auth.uid())
  and private.is_teacher()
);

create policy courses_update_owner
on public.courses for update to authenticated
using (teacher_id = (select auth.uid()))
with check (teacher_id = (select auth.uid()));

create policy courses_delete_owner
on public.courses for delete to authenticated
using (teacher_id = (select auth.uid()));

create policy course_members_select_participating
on public.course_members for select to authenticated
using (
  student_id = (select auth.uid())
  or private.is_course_teacher(course_id)
);

create policy course_members_delete_participating
on public.course_members for delete to authenticated
using (
  student_id = (select auth.uid())
  or private.is_course_teacher(course_id)
);

create policy assignments_select_participating
on public.assignments for select to authenticated
using (
  private.is_course_teacher(course_id)
  or (status <> 'draft' and private.is_course_member(course_id))
);

create policy assignments_insert_teacher
on public.assignments for insert to authenticated
with check (private.is_course_teacher(course_id));

create policy assignments_update_teacher
on public.assignments for update to authenticated
using (private.is_course_teacher(course_id))
with check (private.is_course_teacher(course_id));

create policy assignments_delete_teacher
on public.assignments for delete to authenticated
using (private.is_course_teacher(course_id));

create policy submissions_select_participating
on public.submissions for select to authenticated
using (
  student_id = (select auth.uid())
  or private.can_manage_assignment(assignment_id)
);

create or replace function public.join_course(p_join_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_course_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'You must sign in before joining a class.';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'student'
  ) then
    raise exception 'Only student accounts can join a class.';
  end if;

  select c.id into target_course_id
  from public.courses c
  where c.join_code = upper(trim(p_join_code)) and c.archived_at is null;

  if target_course_id is null then
    raise exception 'Class code not found or class unavailable.';
  end if;

  insert into public.course_members (course_id, student_id)
  values (target_course_id, (select auth.uid()))
  on conflict do nothing;

  return target_course_id;
end;
$$;

create or replace function public.save_submission(
  p_assignment_id uuid,
  p_content jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  submission_id uuid;
  can_resubmit boolean;
  existing_status public.submission_status;
begin
  if jsonb_typeof(p_content) <> 'object' then
    raise exception 'Submission content must be an object.';
  end if;

  select a.allow_resubmission, s.status
  into can_resubmit, existing_status
  from public.assignments a
  left join public.submissions s
    on s.assignment_id = a.id and s.student_id = (select auth.uid())
  where
    a.id = p_assignment_id
    and a.status = 'published'
    and private.is_course_member(a.course_id);

  if not found then
    raise exception 'This assignment is not available to you.';
  end if;

  if existing_status in ('submitted', 'returned') and not can_resubmit then
    raise exception 'This assignment has already been submitted.';
  end if;

  insert into public.submissions (
    assignment_id,
    student_id,
    content,
    status,
    submitted_at,
    returned_at
  )
  values (
    p_assignment_id,
    (select auth.uid()),
    p_content,
    'draft',
    null,
    null
  )
  on conflict (assignment_id, student_id) do update
  set content = excluded.content,
      status = 'draft',
      submitted_at = null,
      returned_at = null
  returning id into submission_id;

  return submission_id;
end;
$$;

create or replace function public.submit_assignment(
  p_assignment_id uuid,
  p_content jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  submission_id uuid;
  can_resubmit boolean;
  existing_status public.submission_status;
begin
  if jsonb_typeof(p_content) <> 'object' then
    raise exception 'Submission content must be an object.';
  end if;

  select a.allow_resubmission, s.status
  into can_resubmit, existing_status
  from public.assignments a
  left join public.submissions s
    on s.assignment_id = a.id and s.student_id = (select auth.uid())
  where
    a.id = p_assignment_id
    and a.status = 'published'
    and private.is_course_member(a.course_id);

  if not found then
    raise exception 'This assignment is not available to you.';
  end if;

  if existing_status in ('submitted', 'returned') and not can_resubmit then
    raise exception 'This assignment has already been submitted.';
  end if;

  insert into public.submissions (
    assignment_id,
    student_id,
    content,
    status,
    submitted_at,
    returned_at
  )
  values (
    p_assignment_id,
    (select auth.uid()),
    p_content,
    'submitted',
    now(),
    null
  )
  on conflict (assignment_id, student_id) do update
  set content = excluded.content,
      status = 'submitted',
      submitted_at = now(),
      returned_at = null
  returning id into submission_id;

  return submission_id;
end;
$$;

create or replace function public.return_submission(
  p_submission_id uuid,
  p_feedback text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.submissions s
  set feedback = coalesce(p_feedback, ''),
      status = 'returned',
      returned_at = now()
  where
    s.id = p_submission_id
    and private.can_manage_assignment(s.assignment_id);

  if not found then
    raise exception 'Submission not found or you do not manage its assignment.';
  end if;
end;
$$;

revoke all on function public.join_course(text) from public, anon;
revoke all on function public.save_submission(uuid, jsonb) from public, anon;
revoke all on function public.submit_assignment(uuid, jsonb) from public, anon;
revoke all on function public.return_submission(uuid, text) from public, anon;
grant execute on function public.join_course(text) to authenticated;
grant execute on function public.save_submission(uuid, jsonb) to authenticated;
grant execute on function public.submit_assignment(uuid, jsonb) to authenticated;
grant execute on function public.return_submission(uuid, text) to authenticated;

comment on table public.courses is 'Teacher-owned classes. join_code is used by students to enroll.';
comment on table public.assignments is 'Teacher-authored accessible assignment documents.';
comment on table public.submissions is 'Student-owned draft or submitted assignment documents.';

commit;
