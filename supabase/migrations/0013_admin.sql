-- Lightweight pilot admin visibility: a small number of hand-flagged admin
-- users can read (never write) everyone's data for pilot tracking/export.
-- Deliberately not a multi-tenant company/org model — that's a materially
-- bigger build (per-company data isolation, invite flows, self-serve admin
-- roles) that should come after the pilot validates demand, not before.

alter table public.profiles
  add column if not exists email text,
  add column if not exists is_admin boolean not null default false;

-- Backfill email for any profiles created before this column existed.
-- Requires running this migration as a role with access to auth.users
-- (the Supabase SQL editor runs as postgres, which has that access).
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email);
  return new;
end;
$$;

-- security definer + a plain boolean lookup avoids RLS self-recursion when
-- this function is called from a policy defined on profiles itself.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin());

create policy "Admins can view all gap analyses"
  on public.gap_analyses for select
  using (public.is_admin());

create policy "Admins can view all assessment results"
  on public.assessment_results for select
  using (public.is_admin());

create policy "Admins can view all development plans"
  on public.development_plans for select
  using (public.is_admin());

create policy "Admins can view all milestones"
  on public.milestones for select
  using (public.is_admin());

-- To make a pilot user an admin, run manually in the SQL editor:
-- update public.profiles set is_admin = true where email = 'admin@example.com';
