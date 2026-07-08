-- Lets an org admin assign a task (milestone) directly onto an employee's
-- development plan instead of the HR dashboard being purely read-only.
-- Scoped through the same is_org_admin_of_user() check already used for
-- read access (0016_organizations.sql), so an admin can only write into a
-- plan owned by someone in their own organization, never anyone else's.
-- If the employee has no plan yet, the admin can also create one on their
-- behalf, gated by the same cross-org-membership check.
alter table public.milestones
  add column if not exists assigned_by uuid references auth.users (id) on delete set null;

drop policy if exists "Org admins can create plans for their members" on public.development_plans;
create policy "Org admins can create plans for their members"
  on public.development_plans for insert
  with check (public.is_org_admin_of_user(user_id));

drop policy if exists "Org admins can assign milestones to their members' plans" on public.milestones;
create policy "Org admins can assign milestones to their members' plans"
  on public.milestones for insert
  with check (
    exists (
      select 1 from public.development_plans p
      where p.id = milestones.plan_id and public.is_org_admin_of_user(p.user_id)
    )
  );
