-- Student discount verification: a school-email code exchange, separate
-- from Supabase Auth (the user keeps signing in with their normal email —
-- this only proves they *also* control a .edu/school inbox).
create table if not exists public.student_verification_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  school_email text not null,
  code text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.student_verification_codes enable row level security;

drop policy if exists "Users can view their own verification codes" on public.student_verification_codes;
create policy "Users can view their own verification codes"
  on public.student_verification_codes for select
  using (user_id = auth.uid());

-- This app has no service-role key — server actions run with the caller's
-- own session, so writes still go through RLS like any browser call.
-- Insert/update policies are required here, not optional.
drop policy if exists "Users can insert their own verification codes" on public.student_verification_codes;
create policy "Users can insert their own verification codes"
  on public.student_verification_codes for insert
  with check (user_id = auth.uid());

drop policy if exists "Users can update their own verification codes" on public.student_verification_codes;
create policy "Users can update their own verification codes"
  on public.student_verification_codes for update
  using (user_id = auth.uid());

-- Needed for account data deletion (deleteMyData) to actually be able to
-- remove this data, not just insert/read it.
drop policy if exists "Users can delete their own verification codes" on public.student_verification_codes;
create policy "Users can delete their own verification codes"
  on public.student_verification_codes for delete
  using (user_id = auth.uid());

alter table public.profiles
  add column if not exists student_verified_at timestamptz,
  add column if not exists student_school_email text;
