-- 0199 -- Org chart: planning data is admin-only, and the database refuses
-- reporting loops (rollout audit 2026-10-10).
--
-- 1. CONFIRMED live: any ordinary member could read their company's vacant /
--    future / frozen positions, every saved chart snapshot and annotation, and
--    the saved views -- the data an admin uses to plan a restructure or
--    headcount change. The org chart page itself is admin-only and nothing
--    else in the app reads these tables as a member, so the member SELECT
--    policies served nothing but exposure. Dropped; admins keep full access
--    (their "for all" policies already cover SELECT, and positions gets an
--    explicit admin SELECT policy). Functions that read positions
--    (history_manager_label, delete/fill_org_position) are SECURITY DEFINER
--    and unaffected.
--
-- 2. CONFIRMED live: a direct write could make A manage B and B manage A. The
--    app's setMemberManager guards this, but the database did not, and a
--    closed loop has no root so both people dropped off the chart. A BEFORE
--    trigger now walks the chain (within the same company, at most 100 steps)
--    and refuses a manager_user_id that is the person themselves or leads back
--    to them. It fires only when manager_user_id is inserted or changed.
--    Existing rows are not touched.
--
-- Depends on 0072 (manager_user_id), 0105/0106/0121/0125 (the chart tables).

-- 1. admin-only planning data
drop policy if exists "Org members can view positions" on public.org_positions;
drop policy if exists "Org admins can view positions" on public.org_positions;
create policy "Org admins can view positions"
  on public.org_positions for select
  using (public.is_org_admin(organization_id));

drop policy if exists "Org members can view org chart snapshots" on public.org_chart_snapshots;
drop policy if exists "Org members can view org chart saved views" on public.org_chart_saved_views;
drop policy if exists "Org members can view org chart annotations" on public.org_chart_annotations;

-- 2. no reporting loops
create or replace function public.trg_members_no_reporting_loop()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cur uuid := new.manager_user_id;
  v_steps int := 0;
begin
  if v_cur is null then
    return new;
  end if;
  if v_cur = new.user_id then
    raise exception 'Someone cannot be their own manager' using errcode = '23514';
  end if;

  while v_cur is not null and v_steps < 100 loop
    if v_cur = new.user_id then
      raise exception 'That would create a reporting loop' using errcode = '23514';
    end if;
    select om.manager_user_id into v_cur
    from public.organization_members om
    where om.organization_id = new.organization_id and om.user_id = v_cur
    limit 1;
    v_steps := v_steps + 1;
  end loop;

  return new;
end;
$$;

drop trigger if exists organization_members_no_reporting_loop on public.organization_members;
create trigger organization_members_no_reporting_loop
  before insert or update of manager_user_id on public.organization_members
  for each row execute function public.trg_members_no_reporting_loop();
