-- ROLLBACK for migration 0209: nobody, admin or not, can assign a knowledge check to themselves again (the 0207 rule).
-- Existing checks are not touched.
drop policy if exists "Assign knowledge checks" on public.knowledge_checks;
create policy "Assign knowledge checks"
  on public.knowledge_checks for insert
  with check (
    assigned_by = auth.uid()
    and employee_user_id <> auth.uid()
    and answers is null
    and submitted_at is null
    and (public.is_org_admin(organization_id) or public.is_manager_of_user(employee_user_id))
    and public.knowledge_check_member_ok(employee_user_id, organization_id)
  );
