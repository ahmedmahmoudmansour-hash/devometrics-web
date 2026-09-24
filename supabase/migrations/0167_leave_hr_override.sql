-- HR override for leave decisions — an org admin can change an
-- already-decided (approved/rejected) request after the fact, e.g. a
-- manager approved something that turns out to conflict with policy, or
-- rejected something HR wants to reverse.
--
-- Deliberately a SEPARATE event from the original decision, not an
-- overwrite of decided_at/decided_by/decision_comment — both the original
-- manager (or admin) decision AND the override are visible on the row
-- afterward, not just the latest state. Org-admin only (not
-- is_manager_of_user) — a manager can decide once via decide_leave_request
-- (0166), but reversing a decision after the fact is specifically an HR
-- capability, not something a peer manager can do to another manager's
-- call.
--
-- The existing balance-bookkeeping trigger (trg_update_leave_balance_on_
-- status_change, 0166) already reacts to ANY status change on this table
-- regardless of which function caused it — an override flipping
-- approved->rejected (or back) automatically adjusts leave_balances.
-- used_days correctly with no new trigger logic needed.
--
-- Depends on 0166 (leave_requests, is_org_admin).

alter table public.leave_requests
  add column if not exists overridden_at timestamptz,
  add column if not exists overridden_by uuid references auth.users (id),
  add column if not exists override_reason text;

create or replace function public.override_leave_decision(p_request_id uuid, p_decision text, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.leave_requests%rowtype;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Invalid decision';
  end if;

  select * into v_req from public.leave_requests where id = p_request_id limit 1;
  if v_req.id is null then
    raise exception 'Not found';
  end if;
  if not public.is_org_admin(v_req.organization_id) then
    raise exception 'Not authorized';
  end if;
  if v_req.status not in ('approved', 'rejected') then
    raise exception 'Only an already-decided request can be overridden';
  end if;
  if v_req.status = p_decision then
    raise exception 'Already set to this decision';
  end if;

  update public.leave_requests
  set status = p_decision, overridden_at = now(), overridden_by = auth.uid(), override_reason = p_reason
  where id = p_request_id;

  return true;
end;
$$;

revoke all on function public.override_leave_decision(uuid, text, text) from public;
grant execute on function public.override_leave_decision(uuid, text, text) to authenticated;
