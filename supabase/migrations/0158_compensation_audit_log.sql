-- Compensation Management, part 5/7: the audit log + write-side logging
-- trigger. Depends on 0157 (has_compensation_access).
--
-- Numbering note: the plan's draft sequence had a separate
-- "0158_compensation_config_rls.sql" for salary_bands/compensation_
-- terminology's policies — those were folded directly into 0154 instead
-- (they only depend on is_org_member/is_org_admin, which already existed,
-- so splitting schema and policy across two files added nothing). This
-- migration takes the next number instead of leaving a gap.
--
-- Read-side logging (every SELECT, not just writes) cannot be done via a
-- trigger — Postgres has no SELECT trigger — so reads are logged by the
-- RPCs themselves in 0159/0160, which call this same
-- record_compensation_audit_event() helper before returning data. Write-
-- side logging uses a trigger specifically so "no future write path can
-- accidentally bypass it" — the exact reasoning migration 0147's
-- record_score_event() trigger already established for this codebase.

-- ============================================================
-- compensation_audit_log — append-only. SELECT restricted to Compensation
-- Admins only (not general org admins — who's-being-looked-at is itself
-- sensitive-adjacent metadata). No INSERT policy for authenticated/anon at
-- all; every row is written by SECURITY DEFINER functions running as the
-- function owner, which bypasses RLS entirely.
-- ============================================================
create table if not exists public.compensation_audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null check (action in ('view', 'view_batch', 'propose', 'approve', 'reject', 'withdraw', 'edit', 'export')),
  subject_user_ids uuid[] not null default '{}',
  record_id uuid,
  summary text not null,
  created_at timestamptz not null default now()
);

alter table public.compensation_audit_log enable row level security;

drop policy if exists "Compensation admins view their org's audit log" on public.compensation_audit_log;
create policy "Compensation admins view their org's audit log"
  on public.compensation_audit_log for select
  using (public.has_compensation_access(organization_id));
-- No insert/update/delete policy for authenticated at all.

create index if not exists compensation_audit_log_org_idx on public.compensation_audit_log (organization_id, created_at desc);
create index if not exists compensation_audit_log_actor_idx on public.compensation_audit_log (actor_user_id, created_at desc);

-- Shared logging helper — SECURITY DEFINER so it can insert into
-- compensation_audit_log despite that table having no INSERT policy for
-- authenticated. Called directly by the read RPCs (0159/0160) and by the
-- write-side trigger below. Never throws (wrapped), matching this repo's
-- convention that a logging failure must never abort the caller's real
-- operation.
create or replace function public.record_compensation_audit_event(
  p_organization_id uuid,
  p_action text,
  p_subject_user_ids uuid[],
  p_record_id uuid,
  p_summary text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.compensation_audit_log (organization_id, actor_user_id, action, subject_user_ids, record_id, summary)
  values (p_organization_id, auth.uid(), p_action, coalesce(p_subject_user_ids, '{}'), p_record_id, p_summary);
exception when others then
  null; -- logging must never abort the operation it's logging
end;
$$;

revoke all on function public.record_compensation_audit_event(uuid, text, uuid[], uuid, text) from public;
grant execute on function public.record_compensation_audit_event(uuid, text, uuid[], uuid, text) to authenticated;

-- Write-side trigger function — fires on every INSERT/UPDATE to the four
-- dollar-bearing tables so a write is logged even if a future RPC author
-- forgets to call record_compensation_audit_event() explicitly.
create or replace function public.trg_compensation_audit_on_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_subject uuid;
  v_action text;
begin
  if tg_table_name = 'compensation_records' then
    v_org_id := new.organization_id;
    v_subject := new.employee_user_id;
    v_action := 'edit';
  elsif tg_table_name = 'compensation_proposals' then
    v_org_id := new.organization_id;
    v_subject := new.employee_user_id;
    v_action := case
      when tg_op = 'INSERT' then 'propose'
      when new.status = 'withdrawn' then 'withdraw'
      else 'edit'
    end;
  elsif tg_table_name = 'compensation_changes' then
    v_org_id := new.organization_id;
    v_subject := new.employee_user_id;
    v_action := 'edit';
  elsif tg_table_name = 'compensation_approvals' then
    select organization_id, employee_user_id into v_org_id, v_subject
    from public.compensation_proposals where id = new.proposal_id limit 1;
    v_action := case when new.decision = 'approved' then 'approve' else 'reject' end;
  end if;

  if v_org_id is not null then
    perform public.record_compensation_audit_event(
      v_org_id, v_action, array[v_subject]::uuid[], new.id,
      format('%s on %s (row %s)', v_action, tg_table_name, new.id)
    );
  end if;

  return new;
exception when others then
  return new; -- never let a logging failure abort the write it's logging
end;
$$;

drop trigger if exists compensation_records_audit_trigger on public.compensation_records;
create trigger compensation_records_audit_trigger
  after insert or update on public.compensation_records
  for each row execute function public.trg_compensation_audit_on_write();

drop trigger if exists compensation_proposals_audit_trigger on public.compensation_proposals;
create trigger compensation_proposals_audit_trigger
  after insert or update on public.compensation_proposals
  for each row execute function public.trg_compensation_audit_on_write();

drop trigger if exists compensation_changes_audit_trigger on public.compensation_changes;
create trigger compensation_changes_audit_trigger
  after insert on public.compensation_changes
  for each row execute function public.trg_compensation_audit_on_write();

drop trigger if exists compensation_approvals_audit_trigger on public.compensation_approvals;
create trigger compensation_approvals_audit_trigger
  after insert on public.compensation_approvals
  for each row execute function public.trg_compensation_audit_on_write();
