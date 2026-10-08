-- ============================================================
-- DEVOMETRICS -- PENDING MIGRATIONS: 0190
--
-- Everything through 0189 is applied and verified live (2026-10-08).
--
-- 0190 -- SECURITY FIX, please run before onboarding any business.
-- Found by the pre-rollout audit and CONFIRMED against the live database:
--   1. [CRITICAL] A logged-in user from one company could read another
--      company's invite code and join it as a member with no invitation,
--      then read its full member list. Fixed: organizations are readable only
--      by their own members/creator/platform admins; a direct join as a member
--      now needs a pending email invite; joining by code moves into a checked
--      function and is OFF by default (new per-company switch in Settings).
--   2. [HIGH] Anonymous (not logged in) callers could reach database
--      functions. Fixed: revoked from anon/public everywhere except cron
--      jobs, the calendar feed and the billing webhook; future functions are
--      private by default.
-- After running it, companies that were joining by code need an admin to
-- switch on Settings > "Join with company code" -- email invites are
-- unaffected.
-- ============================================================

-- ============================================================
-- 1a. Organization rows: members, creator, platform admin only
-- ============================================================
alter table public.organizations
  add column if not exists join_by_code_enabled boolean not null default false;

-- Any membership row, any employment status: a resigned/terminated user must
-- still resolve their own org so the "no longer have access" screens work
-- (is_org_member requires status 'active' since 0172).
create or replace function public.is_org_member_any_status(check_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = check_org_id and user_id = auth.uid()
  );
$$;

drop policy if exists "Authenticated users can look up organizations" on public.organizations;
drop policy if exists "Members, creators and platform admins can read organizations" on public.organizations;
create policy "Members, creators and platform admins can read organizations"
  on public.organizations for select
  using (
    public.is_org_member_any_status(id)
    or created_by = auth.uid()   -- the insert's own .select() right after creating a workspace
    or public.is_admin()
  );

-- ============================================================
-- 1b. Joining as a member now needs a pending invite
-- ============================================================
-- Identical to 0143 except the final 'member' branch (invite-gated).
drop policy if exists "Users can join an organization as themselves" on public.organization_members;
create policy "Users can join an organization as themselves"
  on public.organization_members for insert
  with check (
    user_id = auth.uid()
    and (
      (role = 'admin' and exists (
        select 1 from public.organizations o
        where o.id = organization_members.organization_id and o.created_by = auth.uid()
      ))
      or (role = 'admin' and exists (
        select 1 from public.organization_invites i
        where i.organization_id = organization_members.organization_id
          and i.intended_role = 'admin'
          and i.accepted_at is null
          and lower(i.email) = lower(auth.jwt() ->> 'email')
      ))
      or (role = 'member'
        and public.org_seat_limit_ok(organization_id)
        and exists (
          select 1 from public.organization_invites i
          where i.organization_id = organization_members.organization_id
            and i.accepted_at is null
            and coalesce(i.intended_role, 'member') = 'member'
            and lower(i.email) = lower(auth.jwt() ->> 'email')
        ))
    )
  );

-- ============================================================
-- 1c. Join by company code, as a controlled function
-- ============================================================
-- Same error for "no such code", "switched off" and "company disabled" so the
-- response never confirms that a company exists.
create or replace function public.join_organization_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := lower(trim(coalesce(p_code, '')));
  v_org uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select o.id into v_org
  from public.organizations o
  where v_code <> ''
    and o.slug = v_code
    and o.join_by_code_enabled
    and not coalesce(o.is_disabled, false)
    and o.pending_deletion_at is null
  limit 1;

  if v_org is null then
    raise exception 'No company found with that invite code';
  end if;
  if not public.org_seat_limit_ok(v_org) then
    raise exception 'This company has reached its seat limit';
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org, auth.uid(), 'member')
  on conflict (organization_id, user_id) do nothing;

  return v_org;
end;
$$;

-- ============================================================
-- 2. Function exposure
-- ============================================================
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig, p.proname, p.proargnames
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated, service_role', r.sig);
    -- Genuinely anonymous callers: cron jobs (secret-checked), the calendar
    -- feed (token-checked) and the billing webhook.
    if r.proname in ('calendar_feed', 'set_subscription_tier')
       or (r.proargnames is not null and r.proargnames[1] = 'secret') then
      execute format('grant execute on function %s to anon', r.sig);
    end if;
  end loop;
end $$;

-- Future functions must not be anonymously callable by default again.
alter default privileges for role postgres in schema public revoke execute on functions from public, anon;

-- Internal-only helpers: only ever called from trigger functions, which run
-- as their owner and need no grant. Nobody should be able to call them.
revoke execute on function public.record_score_event(uuid, uuid, text, text, numeric, text, timestamptz, text, uuid, boolean, boolean, jsonb) from authenticated, anon, public;
revoke execute on function public.org_id_for_user(uuid) from authenticated, anon, public;
revoke execute on function public.history_manager_label(uuid, uuid) from authenticated, anon, public;
-- Same for the compensation audit-log writer: only the audited RPCs and triggers (which run
-- as their owner) should ever write to it; left open, any logged-in user could forge audit
-- entries in any company's log.
revoke execute on function public.record_compensation_audit_event(uuid, text, uuid[], uuid, text) from authenticated, anon, public;
