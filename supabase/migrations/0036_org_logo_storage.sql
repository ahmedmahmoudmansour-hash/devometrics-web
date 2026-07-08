-- Company logos, stored in a public Storage bucket (visible wherever the
-- workspace's brand shows up — company dashboard header, employee
-- dashboards). Same pattern as 0022_avatars.sql, but scoped by organization
-- id (via is_org_admin()) instead of by the uploading user's own id, since
-- this is a shared org-level asset, not a personal one.
insert into storage.buckets (id, name, public)
values ('org-logos', 'org-logos', true)
on conflict (id) do nothing;

drop policy if exists "Org logos are publicly readable" on storage.objects;
create policy "Org logos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'org-logos');

drop policy if exists "Org admins can upload their org's logo" on storage.objects;
create policy "Org admins can upload their org's logo"
  on storage.objects for insert
  with check (bucket_id = 'org-logos' and public.is_org_admin(((storage.foldername(name))[1])::uuid));

drop policy if exists "Org admins can update their org's logo" on storage.objects;
create policy "Org admins can update their org's logo"
  on storage.objects for update
  using (bucket_id = 'org-logos' and public.is_org_admin(((storage.foldername(name))[1])::uuid));

drop policy if exists "Org admins can delete their org's logo" on storage.objects;
create policy "Org admins can delete their org's logo"
  on storage.objects for delete
  using (bucket_id = 'org-logos' and public.is_org_admin(((storage.foldername(name))[1])::uuid));
