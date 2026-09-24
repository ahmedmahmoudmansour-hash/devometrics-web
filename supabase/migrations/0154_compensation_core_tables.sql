-- Compensation Management, part 1/8: core tables that don't yet depend on
-- anything defined later in this batch (salary_bands, compensation_records,
-- compensation_terminology) plus the org-level manager-visibility setting.
--
-- Devometrics is a compensation SYSTEM OF RECORD, not a payroll processor —
-- this schema deliberately has no tax/deduction/net-pay/statutory columns
-- anywhere, and never will. See the approved plan
-- (C:\Users\Markatak\.claude\plans\recursive-sleeping-boole.md) for the
-- full spec this batch (0154-0161) implements.
--
-- compensation_records has zero client-facing RLS policies (added nowhere
-- in this batch) — RLS is enabled but deliberately left with no permissive
-- policy for authenticated/anon, because Ahmed's requirement is that EVERY
-- read is audited, and Postgres RLS has no concept of "log a SELECT". All
-- access goes through SECURITY DEFINER RPCs added in 0160/0161, which
-- check authorization, log the access, and return data as one atomic step.
-- A direct `.from("compensation_records").select()` returns an empty
-- array, not an error — fails closed by construction.

-- ============================================================
-- salary_bands — org-wide grade/range config, not per-person data.
-- Direct RLS (mirrors organization_competencies, migration 0035).
-- ============================================================
create table if not exists public.salary_bands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  band_key text not null,               -- stable internal id, e.g. 'L4_ENG'
  display_name text not null,           -- admin's own label, e.g. "Senior Engineer"
  currency text not null default 'USD',
  min_amount numeric(14,2) not null,
  mid_amount numeric(14,2),
  max_amount numeric(14,2) not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint salary_bands_range_check check (
    min_amount <= max_amount and (mid_amount is null or mid_amount between min_amount and max_amount)
  ),
  unique (organization_id, band_key)
);

alter table public.salary_bands enable row level security;

drop policy if exists "Org members can view salary bands" on public.salary_bands;
create policy "Org members can view salary bands"
  on public.salary_bands for select
  using (public.is_org_member(organization_id));

drop policy if exists "Org admins manage salary bands" on public.salary_bands;
create policy "Org admins manage salary bands"
  on public.salary_bands for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create index if not exists salary_bands_org_idx on public.salary_bands (organization_id);

-- ============================================================
-- compensation_records — the historical ledger of what each employee is/
-- was paid, one row per effective period. NO client-facing RLS policies —
-- see header comment. `source_change_id` gets its FK added in 0155 once
-- compensation_changes exists (avoids a forward-reference cycle).
-- ============================================================
create table if not exists public.compensation_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_user_id uuid not null references auth.users (id) on delete cascade,
  salary_band_id uuid references public.salary_bands (id) on delete set null,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'USD',
  pay_frequency text not null default 'annual' check (pay_frequency in ('annual', 'monthly', 'hourly')),
  effective_from date not null,
  effective_to date,                     -- null = currently in effect
  change_reason text,
  source_change_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id)
);

alter table public.compensation_records enable row level security;
-- Deliberately no policies here. See header comment.

-- Scoped by (organization_id, employee_user_id), not employee_user_id
-- alone: organization_members' own uniqueness constraint is
-- (organization_id, user_id), not user_id alone, so the schema technically
-- permits multi-org membership — an org-unscoped index would incorrectly
-- block a legitimate current record in a second org.
create unique index if not exists compensation_records_one_current_uidx
  on public.compensation_records (organization_id, employee_user_id)
  where effective_to is null;
create index if not exists compensation_records_org_idx on public.compensation_records (organization_id);
create index if not exists compensation_records_employee_idx on public.compensation_records (employee_user_id, effective_from desc);

-- ============================================================
-- compensation_terminology — org-level display-label overrides for a
-- fixed set of canonical field keys (defined in TS, see
-- lib/compensation/terminology.ts). Mirrors organization_competencies
-- (0035) exactly: the canonical key is what the app's logic reads/writes;
-- this table only ever supplies a display string, rendered verbatim with
-- no i18n of its own, same as organization_competencies.name.
-- ============================================================
create table if not exists public.compensation_terminology (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  field_key text not null,
  display_label text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, field_key)
);

alter table public.compensation_terminology enable row level security;

drop policy if exists "Org members can view compensation terminology" on public.compensation_terminology;
create policy "Org members can view compensation terminology"
  on public.compensation_terminology for select
  using (public.is_org_member(organization_id));

drop policy if exists "Org admins manage compensation terminology" on public.compensation_terminology;
create policy "Org admins manage compensation terminology"
  on public.compensation_terminology for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create index if not exists compensation_terminology_org_idx on public.compensation_terminology (organization_id);

-- ============================================================
-- organizations.compensation_manager_visibility — org-level 3-state
-- setting controlling what a manager sees of their direct reports'
-- compensation. Defaults to 'none': adding this feature must never
-- silently expose salaries to existing managers — visibility is opt-in.
-- Follows the same idempotent constraint-lookup pattern as
-- review_escalation_levels (0082), since Postgres constraint names can
-- drift and must never be guessed.
-- ============================================================
alter table public.organizations
  add column if not exists compensation_manager_visibility text not null default 'none';

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'organizations'
      and constraint_name = 'organizations_compensation_manager_visibility_check'
  ) then
    alter table public.organizations
      add constraint organizations_compensation_manager_visibility_check
      check (compensation_manager_visibility in ('exact', 'band', 'none'));
  end if;
end $$;
