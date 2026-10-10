-- 0198 -- Knowledge Hub: files are readable only by admins and the employees
-- they are assigned to; the SCORM bucket accepts the file types real packages
-- contain; completion records are bounded (rollout audit 2026-10-10).
--
-- 1. CONFIRMED live: any ordinary member of a company could download any file
--    in that company's Knowledge Hub folder -- including content assigned to
--    other people only (e.g. manager-only training) and the raw SCORM zips --
--    straight from Storage, and list the folder. The storage policy let "any
--    org member" read and left the "is it assigned to me" check to the app.
--    The read policy now requires: org admin, OR the caller has an assignment
--    for a content row whose storage_path is that object (documents) or its
--    parent folder (unpacked SCORM files). The app already required exactly
--    this before issuing a link, so nothing legitimate changes.
--    (The content ROWS -- title/description -- stay visible to members: manager
--    team views read them.)
--
-- 2. CONFIRMED live: the bucket's MIME allow-list rejected files a normal SCORM
--    1.2 package contains. The unpacker uploads each file with a guessed type;
--    anything unrecognised is application/octet-stream, which the bucket
--    refused ("mime type application/octet-stream is not supported"), so a
--    package with an .xsd/.txt/.webp/.ttf/.ico file failed to import. Adds
--    those types (and octet-stream as the catch-all). The bucket stays
--    private and admin-write-only; the app still validates uploads by type.
--
-- 3. submit_scorm_completion: a package's cmi_data larger than 100 KB is
--    stored as {} instead (the completion itself is still recorded) -- it was
--    unbounded -- and a learner can record at most 60 completions per content
--    per hour (it was unlimited, one new row per call).
--
-- Depends on 0084/0149/0151 (bucket, policies, RPC). The RPC keeps its exact
-- signature, so create-or-replace replaces it (no second overload).

-- 1. read policy
drop policy if exists "Org members can read their org's knowledge hub docs" on storage.objects;
drop policy if exists "Admins and assigned employees can read knowledge hub docs" on storage.objects;
create policy "Admins and assigned employees can read knowledge hub docs"
  on storage.objects for select
  using (
    bucket_id = 'knowledge-hub-docs'
    and (
      public.is_org_admin(((storage.foldername(name))[1])::uuid)
      or exists (
        select 1
        from public.knowledge_hub_assignments a
        join public.knowledge_hub_content c on c.id = a.content_id
        where a.employee_user_id = auth.uid()
          and (
            storage.objects.name = c.storage_path
            or starts_with(storage.objects.name, c.storage_path || '/')
          )
      )
    )
  );

-- 2. MIME allow-list
update storage.buckets
set allowed_mime_types = (
  select array_agg(distinct m order by m)
  from unnest(
    coalesce(allowed_mime_types, '{}'::text[]) || array[
      'application/octet-stream',
      'text/plain',
      'image/webp',
      'image/x-icon',
      'image/vnd.microsoft.icon',
      'font/ttf',
      'font/otf',
      'application/vnd.ms-fontobject',
      'application/font-woff',
      'text/vtt',
      'audio/wav',
      'audio/ogg',
      'audio/x-m4a',
      'video/ogg'
    ]::text[]
  ) as m
)
where id = 'knowledge-hub-docs';

-- 3. SCORM completion bounds
create or replace function public.submit_scorm_completion(
  p_content_id uuid,
  p_score_raw numeric,
  p_lesson_status text,
  p_cmi_data jsonb default '{}'::jsonb
)
returns table(score_percent integer, passed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_score integer;
  v_passed boolean;
  v_cmi jsonb := coalesce(p_cmi_data, '{}'::jsonb);
begin
  if not exists (
    select 1 from public.knowledge_hub_assignments
    where content_id = p_content_id and employee_user_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  if not exists (
    select 1 from public.knowledge_hub_content
    where id = p_content_id and content_type = 'scorm'
  ) then
    raise exception 'This content is not a SCORM package';
  end if;

  if p_lesson_status not in ('passed', 'completed', 'failed', 'incomplete', 'browsed', 'not attempted') then
    raise exception 'Invalid SCORM lesson_status';
  end if;

  if (select count(*) from public.knowledge_hub_completions
      where content_id = p_content_id and employee_user_id = auth.uid()
        and method = 'scorm' and completed_at > now() - interval '1 hour') >= 60 then
    raise exception 'Too many completions were recorded recently - try again later';
  end if;

  if octet_length(v_cmi::text) > 100000 then
    v_cmi := '{}'::jsonb;
  end if;

  if p_score_raw is not null and p_score_raw between 0 and 100 then
    v_score := round(p_score_raw)::integer;
  else
    v_score := null;
  end if;
  v_passed := p_lesson_status in ('passed', 'completed');

  insert into public.knowledge_hub_completions
    (content_id, employee_user_id, method, score_percent, passed, answers, completed_at)
  values
    (p_content_id, auth.uid(), 'scorm', v_score, v_passed, v_cmi, now());

  return query select v_score, v_passed;
end;
$$;

revoke all on function public.submit_scorm_completion(uuid, numeric, text, jsonb) from public;
grant execute on function public.submit_scorm_completion(uuid, numeric, text, jsonb) to authenticated;
