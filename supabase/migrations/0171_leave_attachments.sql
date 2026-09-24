-- 0171: Optional supporting documents on leave requests
--
-- An employee can attach a file (sick note, birth certificate, etc.) to
-- any leave request — universally optional, not locked to specific leave
-- types (Sick/Maternity/Paternity), since the employee is best placed to
-- decide when a supporting document is actually relevant. Same private-
-- bucket-plus-signed-URL pattern as candidate CVs (0088) and Knowledge Hub
-- content (0084): the bucket itself is never public, every read goes
-- through a short-lived (300s) signed URL issued only after the caller's
-- own RLS-checked visibility into the owning leave_requests row is
-- confirmed server-side.
--
-- Path shape: {organization_id}/{employee_user_id}/{uuid}-{filename} — the
-- uuid prefix avoids same-filename collisions across multiple requests
-- from the same employee (a candidate only ever has one CV at a time, so
-- 0088 didn't need this, but an employee can attach a different note to
-- each of several requests).
--
-- Visibility mirrors leave_requests' own SELECT policy (self, org admin,
-- or the employee's manager) — a manager reviewing a pending request
-- needs to see the same attachment they'd see in-app, not a narrower set.

alter table public.leave_requests
  add column if not exists attachment_storage_path text;
alter table public.leave_requests
  add column if not exists attachment_file_name text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'leave-attachments',
  'leave-attachments',
  false,
  8388608,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- (storage.foldername(name))[1] = organization_id, [2] = employee_user_id.
drop policy if exists "Employees upload their own leave attachments" on storage.objects;
create policy "Employees upload their own leave attachments"
  on storage.objects for insert
  with check (
    bucket_id = 'leave-attachments'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
    and ((storage.foldername(name))[2])::uuid = auth.uid()
  );

drop policy if exists "Employees manage their own leave attachments" on storage.objects;
create policy "Employees manage their own leave attachments"
  on storage.objects for all
  using (
    bucket_id = 'leave-attachments'
    and ((storage.foldername(name))[2])::uuid = auth.uid()
  )
  with check (
    bucket_id = 'leave-attachments'
    and ((storage.foldername(name))[2])::uuid = auth.uid()
  );

-- Same visibility as the leave_requests row itself: self (covered above),
-- org admin, or the employee's manager.
drop policy if exists "Admins and managers can read leave attachments" on storage.objects;
create policy "Admins and managers can read leave attachments"
  on storage.objects for select
  using (
    bucket_id = 'leave-attachments'
    and (
      public.is_org_admin(((storage.foldername(name))[1])::uuid)
      or public.is_manager_of_user(((storage.foldername(name))[2])::uuid)
    )
  );
