-- Public signup can no longer choose a role.
-- Supabase treats raw_user_meta_data as user-controlled data, so it must never
-- decide authorization. Teacher access is granted by an administrator only, and
-- the unused classroom API is closed until a teacher product actually exists.

begin;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text;
begin
  requested_name := left(
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'New user'
    ),
    100
  );

  -- Role is fixed here on purpose. Do not read it from new.raw_user_meta_data.
  insert into public.profiles (id, display_name, role)
  values (new.id, requested_name, 'student'::public.user_role);
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

comment on function private.handle_new_user() is
  'Creates a student profile for every new auth user. Teacher role is assigned only by an administrator running SQL against public.profiles.';

-- No teacher account should exist yet, and any that does was self-assigned at signup.
update public.profiles set role = 'student' where role = 'teacher';

-- Close the classroom surface that the shipped app does not use.
revoke select, insert, update, delete on table public.courses from authenticated;
revoke select, delete on table public.course_members from authenticated;
revoke select, insert, update, delete on table public.assignments from authenticated;
revoke select on table public.submissions from authenticated;
revoke execute on function public.join_course(text) from authenticated;
revoke execute on function public.save_submission(uuid, jsonb) from authenticated;
revoke execute on function public.submit_assignment(uuid, jsonb) from authenticated;
revoke execute on function public.return_submission(uuid, text) from authenticated;

comment on table public.courses is
  'Reserved for a future teacher product. No browser client may read or write this table.';

commit;
