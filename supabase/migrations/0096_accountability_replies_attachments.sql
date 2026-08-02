-- Extends Accountability Groups (0075) with threaded replies and file
-- attachments on check-ins, plus storage for the attachments themselves.
-- Same posture as 0075: an individual-experience feature, not an
-- org-admin one -- membership in the group is the only gate, reusing
-- is_accountability_group_member() rather than a new helper.

create table if not exists public.accountability_checkin_replies (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references public.accountability_checkins(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.accountability_checkin_attachments (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references public.accountability_checkins(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_size_bytes bigint not null,
  mime_type text not null,
  created_at timestamptz not null default now()
);

alter table public.accountability_checkin_replies enable row level security;
alter table public.accountability_checkin_attachments enable row level security;

-- Both tables key off checkin_id rather than storing group_id redundantly
-- -- same non-denormalized join pattern as 0016's milestones-via-
-- development_plans policy -- so membership is always checked against the
-- one real source of truth (accountability_group_members), never a copy
-- that could drift.

drop policy if exists "Members can view checkin replies" on public.accountability_checkin_replies;
create policy "Members can view checkin replies"
  on public.accountability_checkin_replies for select
  using (
    exists (
      select 1 from public.accountability_checkins c
      where c.id = accountability_checkin_replies.checkin_id
        and public.is_accountability_group_member(c.group_id, auth.uid())
    )
  );

drop policy if exists "Members can post their own replies" on public.accountability_checkin_replies;
create policy "Members can post their own replies"
  on public.accountability_checkin_replies for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.accountability_checkins c
      where c.id = accountability_checkin_replies.checkin_id
        and public.is_accountability_group_member(c.group_id, auth.uid())
    )
  );

drop policy if exists "Members can delete their own replies" on public.accountability_checkin_replies;
create policy "Members can delete their own replies"
  on public.accountability_checkin_replies for delete
  using (user_id = auth.uid());

drop policy if exists "Members can view checkin attachments" on public.accountability_checkin_attachments;
create policy "Members can view checkin attachments"
  on public.accountability_checkin_attachments for select
  using (
    exists (
      select 1 from public.accountability_checkins c
      where c.id = accountability_checkin_attachments.checkin_id
        and public.is_accountability_group_member(c.group_id, auth.uid())
    )
  );

drop policy if exists "Members can attach their own files" on public.accountability_checkin_attachments;
create policy "Members can attach their own files"
  on public.accountability_checkin_attachments for insert
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.accountability_checkins c
      where c.id = accountability_checkin_attachments.checkin_id
        and public.is_accountability_group_member(c.group_id, auth.uid())
    )
  );

drop policy if exists "Members can delete their own attachments" on public.accountability_checkin_attachments;
create policy "Members can delete their own attachments"
  on public.accountability_checkin_attachments for delete
  using (uploaded_by = auth.uid());

create index if not exists accountability_checkin_replies_checkin_idx on public.accountability_checkin_replies (checkin_id, created_at asc);
create index if not exists accountability_checkin_attachments_checkin_idx on public.accountability_checkin_attachments (checkin_id);

-- ============================================================
-- Storage: private bucket, signed-URL reads
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'accountability-files',
  'accountability-files',
  false,
  20971520,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png',
    'image/jpeg',
    'text/plain'
  ]::text[]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path convention: {group_id}/{checkin_id}/{file_name} -- the folder's
-- first segment is the group_id, checked directly against the same
-- is_accountability_group_member() used everywhere else on this feature.

drop policy if exists "Members can upload accountability files" on storage.objects;
create policy "Members can upload accountability files"
  on storage.objects for insert
  with check (bucket_id = 'accountability-files' and public.is_accountability_group_member(((storage.foldername(name))[1])::uuid, auth.uid()));

drop policy if exists "Members can read their group's accountability files" on storage.objects;
create policy "Members can read their group's accountability files"
  on storage.objects for select
  using (bucket_id = 'accountability-files' and public.is_accountability_group_member(((storage.foldername(name))[1])::uuid, auth.uid()));

-- Delete keyed on Storage's own `owner` column (set automatically to the
-- uploading user) rather than re-deriving membership -- matches the "only
-- the uploader can delete" rule already enforced on the attachments table
-- row itself.
drop policy if exists "Uploader can delete their accountability file" on storage.objects;
create policy "Uploader can delete their accountability file"
  on storage.objects for delete
  using (bucket_id = 'accountability-files' and owner = auth.uid());
