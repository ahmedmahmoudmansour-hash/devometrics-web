-- Compensation Management, part 2/8: the propose -> approve -> apply
-- workflow tables. Depends on 0154 (compensation_records, salary_bands).
--
-- Managers can never write compensation_records directly — there is no
-- INSERT/UPDATE policy on that table for anyone, and no RPC in this batch
-- lets a manager touch it. A manager's only path is
-- compensation_proposals, which a Compensation Admin must separately
-- decide on (0161's decide_compensation_proposal) before anything actually
-- changes. That separation of duties is structural, not a UI convention.

-- ============================================================
-- compensation_proposals — a manager's or Comp Admin's requested change,
-- awaiting decision. No client-facing RLS policies — same "every access
-- must be audited" reasoning as compensation_records (see 0154).
-- ============================================================
create table if not exists public.compensation_proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_user_id uuid not null references auth.users (id) on delete cascade,
  proposed_by uuid not null references auth.users (id),
  proposed_amount numeric(14,2) not null check (proposed_amount >= 0),
  proposed_currency text not null default 'USD',
  proposed_salary_band_id uuid references public.salary_bands (id) on delete set null,
  proposed_effective_date date not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users (id)
);

alter table public.compensation_proposals enable row level security;
-- Deliberately no policies. See header comment.

create index if not exists compensation_proposals_org_status_idx on public.compensation_proposals (organization_id, status);
create index if not exists compensation_proposals_employee_idx on public.compensation_proposals (employee_user_id);

-- ============================================================
-- compensation_approvals — one row per decision on a proposal. Kept
-- separate from compensation_proposals.status so a future multi-step
-- approval chain (e.g. Comp Admin -> Finance) doesn't require reshaping
-- the proposal table. No client-facing RLS policies.
-- ============================================================
create table if not exists public.compensation_approvals (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.compensation_proposals (id) on delete cascade,
  approver_user_id uuid not null references auth.users (id),
  decision text not null check (decision in ('approved', 'rejected')),
  comment text,
  decided_at timestamptz not null default now()
);

alter table public.compensation_approvals enable row level security;
-- Deliberately no policies. See header comment.

create index if not exists compensation_approvals_proposal_idx on public.compensation_approvals (proposal_id);

-- ============================================================
-- compensation_changes — the applied "event" once a proposal is executed
-- (or a direct Comp Admin correction with no proposal, e.g. a bulk
-- import). compensation_records.source_change_id points back here. No
-- client-facing RLS policies.
-- ============================================================
create table if not exists public.compensation_changes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_user_id uuid not null references auth.users (id) on delete cascade,
  proposal_id uuid references public.compensation_proposals (id) on delete set null,
  old_amount numeric(14,2),
  new_amount numeric(14,2) not null,
  old_salary_band_id uuid references public.salary_bands (id) on delete set null,
  new_salary_band_id uuid references public.salary_bands (id) on delete set null,
  effective_date date not null,
  applied_by uuid not null references auth.users (id),
  applied_at timestamptz not null default now()
);

alter table public.compensation_changes enable row level security;
-- Deliberately no policies. See header comment.

create index if not exists compensation_changes_org_idx on public.compensation_changes (organization_id, applied_at desc);
create index if not exists compensation_changes_employee_idx on public.compensation_changes (employee_user_id);

-- Close the forward-reference cycle from 0154: compensation_records was
-- created first (compensation_changes didn't exist yet), so its FK is
-- added here now that the target table exists. Constraint name looked up
-- first per this repo's migration discipline, never guessed.
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'compensation_records'
      and constraint_name = 'compensation_records_source_change_id_fkey'
  ) then
    alter table public.compensation_records
      add constraint compensation_records_source_change_id_fkey
      foreign key (source_change_id) references public.compensation_changes (id) on delete set null;
  end if;
end $$;
