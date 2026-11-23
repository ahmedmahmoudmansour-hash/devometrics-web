-- ROLLBACK for migration 0212: puts is_my_report_role back to the 0211 rule (manager link only). Safe: replaces one function only.
create or replace function public.is_my_report_role(p_role_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.organization_members m
    where m.manager_user_id = auth.uid() and m.current_role_id = p_role_id
  );
exception when others then
  return false;
end;
$$;

revoke all on function public.is_my_report_role(uuid) from public;
grant execute on function public.is_my_report_role(uuid) to authenticated;
