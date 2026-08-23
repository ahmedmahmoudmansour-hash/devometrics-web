-- 0143: Fix a self-referential comparison in the invite-based admin join
-- policy on organization_members
--
-- Found 2026-08-23 while debugging an unrelated demo-data-seeding issue.
-- The "Users can join an organization as themselves" INSERT policy
-- (0016, widened in 0079/0081) has an invite-based admin-join branch that
-- correlates against the row being inserted like this:
--
--   exists (
--     select 1 from public.organization_invites i
--     where i.organization_id = organization_id   -- BUG
--       and i.intended_role = 'admin'
--       ...
--   )
--
-- organization_invites itself HAS a column named organization_id, so the
-- bare `organization_id` on the right-hand side binds to i.organization_id
-- (the innermost matching scope) instead of the outer new-row's
-- organization_id — confirmed via pg_get_expr on the live policy, which
-- shows the compiled expression as `i.organization_id = i.organization_id`,
-- a tautology. The other EXISTS branch in this same policy (matching
-- against public.organizations, which has no organization_id column of
-- its own) doesn't have this shadowing problem, which is why it wasn't
-- caught earlier — it's specific to this one subquery correlating against
-- a table that happens to share the column name.
--
-- Effect: this branch's org-matching check silently did nothing — an
-- exists() that only actually filtered on intended_role/accepted_at/email,
-- not organization_id. Not an open security hole on its own (the other
-- three conditions in the branch still gate correctly, and email must
-- match the caller's own verified JWT email), but a real logic bug: it
-- meant this invite-based admin-join path was matching more broadly than
-- intended. Fixed by explicitly qualifying the outer reference with the
-- table name, which is unambiguous regardless of what columns exist in
-- the subquery's own scope.
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
      or (role = 'member' and public.org_seat_limit_ok(organization_id))
    )
  );
