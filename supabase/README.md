# Supabase setup for Digi Math Pad

This directory contains the reviewed database migrations for teacher and student accounts.

## Development project setup

1. In the Supabase dashboard, open the new development project.
2. Open **SQL Editor**, choose **New query**, and paste the complete contents of
   `migrations/202609090001_classroom_foundation.sql`.
3. Choose **Run** once. The query should complete without an error.
4. Run `migrations/202609090002_personal_workspaces.sql` once. This adds private,
   cross-device storage for each signed-in user's practice and working documents.
5. Run `migrations/202609120001_student_only_signup.sql` once. This is required: it stops
   signup metadata from choosing a role and closes the unused classroom API.
6. Open **Connect** and copy the Project URL and Publishable key.
7. In `pad/`, copy `.env.example` to `.env.local` and replace the two placeholder values.
8. Restart `npm.cmd run dev` after changing `.env.local`.

`.env.local` is ignored by Git. Never place the database password, secret key, or legacy
`service_role` key in the Pad. Those credentials bypass browser access rules.

## What the migrations create

- Private signed-in workspaces for cross-device practice, one row per user
- Profiles that are always created as students
- Database-enforced Row Level Security for every browser-accessible table

The classroom tables and functions (courses, memberships, assignments, submissions) exist in
the schema but are reserved for a future teacher product. The third migration revokes browser
access to all of them, so the shipped app can reach only `profiles` and `personal_workspaces`.

## Roles

Public signup always creates a `student` profile. `raw_user_meta_data` is user-controlled, so
it never decides authorization. To grant teacher access later, an administrator must run SQL
directly against `public.profiles`; there is no self-service path and no client code that can
request one.

## Before real student use

Use fictional accounts during development. A college or school must review student-data and
vendor requirements before real course records or grades are stored.
