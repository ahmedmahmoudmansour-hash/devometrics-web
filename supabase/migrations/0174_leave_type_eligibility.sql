-- Leave type eligibility — not every leave type should be offered to every
-- employee (Ahmed's example: Maternity/Paternity, but explicitly "can be
-- other" too — this is a general mechanism, not hardcoded to those two
-- names). leave_types gains a simple two-state `eligibility` flag:
-- 'everyone' (default, unchanged behavior for every existing type) or
-- 'restricted', in which case only employees with an explicit grant row in
-- leave_type_eligibility can see/request it. HR picks who's eligible by
-- hand, same "HR vets and handles it" posture already established for
-- allocated_days (0166) rather than trying to infer eligibility from any
-- profile attribute — this app has no gender/demographic field to key off
-- of, and guessing one would be worse than an explicit grant list.
--
-- Same lightweight direct-RLS pattern as the rest of leave management
-- (0166), not compensation's RPC-only lockdown — this is "who can request
-- which leave type," not sensitive financial data.

alter table public.leave_types add column if not exists eligibility text not null default 'everyone';

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'leave_types'
      and constraint_name = 'leave_types_eligibility_check'
  ) then
    alter table public.leave_types
      add constraint leave_types_eligibility_check
      check (eligibility in ('everyone', 'restricted'));
  end if;
end $$;

create table if not exists public.leave_type_eligibility (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  leave_type_id uuid not null references public.leave_types (id) on delete cascade,
  employee_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  unique (leave_type_id, employee_user_id)
);

alter table public.leave_type_eligibility enable row level security;

-- Org admins manage the grant list (add/remove who's eligible for a
-- restricted type). Mirrors leave_types' own admin-manages policy exactly.
drop policy if exists "Org admins manage leave type eligibility" on public.leave_type_eligibility;
create policy "Org admins manage leave type eligibility"
  on public.leave_type_eligibility for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

-- An employee can see their own grants — lets listMyEligibleLeaveTypes()
-- (lib/leave/actions.ts) filter restricted types down to "am I on the
-- list" with a plain self-scoped select, no RPC required.
drop policy if exists "Employees see their own eligibility grants" on public.leave_type_eligibility;
create policy "Employees see their own eligibility grants"
  on public.leave_type_eligibility for select
  using (employee_user_id = auth.uid());

create index if not exists leave_type_eligibility_org_idx on public.leave_type_eligibility (organization_id);
create index if not exists leave_type_eligibility_type_idx on public.leave_type_eligibility (leave_type_id);
create index if not exists leave_type_eligibility_employee_idx on public.leave_type_eligibility (employee_user_id);
