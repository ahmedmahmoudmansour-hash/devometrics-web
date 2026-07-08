-- HR pulse/culture surveys: AI-drafted questions, org admin assigns to
-- chosen employees, results are only ever visible in aggregate.
--
-- Anonymity is enforced at the RLS layer, not just hidden in the UI:
-- survey_responses has NO admin select policy at all. Admins can only read
-- results through get_survey_response_values() below, which strips user_id
-- entirely and refuses to return anything until at least 3 people have
-- responded — below that threshold, individual answers are too easy to
-- attribute in a small team.

create table if not exists public.surveys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  theme text not null,
  questions jsonb not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.survey_assignments (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  employee_user_id uuid not null references auth.users(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unique (survey_id, employee_user_id)
);

-- answers is keyed by question id: { "q1": 4, "q2": "Strongly agree" }.
-- Deliberately no free-text question type in this v1 — open comments can't
-- be safely aggregated the way ratings/multiple-choice can, since writing
-- style or specific content can identify the author even without a name
-- attached. Revisit only with a real design for that, not by accident.
create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  answers jsonb not null,
  submitted_at timestamptz not null default now(),
  unique (survey_id, user_id)
);

alter table public.surveys enable row level security;
alter table public.survey_assignments enable row level security;
alter table public.survey_responses enable row level security;

drop policy if exists "Org admins manage their surveys" on public.surveys;
create policy "Org admins manage their surveys"
  on public.surveys for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Assigned employees can view their surveys" on public.surveys;
create policy "Assigned employees can view their surveys"
  on public.surveys for select
  using (
    exists (
      select 1 from public.survey_assignments sa
      where sa.survey_id = surveys.id and sa.employee_user_id = auth.uid()
    )
  );

drop policy if exists "Org admins manage assignments for their surveys" on public.survey_assignments;
create policy "Org admins manage assignments for their surveys"
  on public.survey_assignments for all
  using (
    exists (
      select 1 from public.surveys s
      where s.id = survey_assignments.survey_id and public.is_org_admin(s.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.surveys s
      where s.id = survey_assignments.survey_id and public.is_org_admin(s.organization_id)
    )
  );

drop policy if exists "Employees can view their own assignments" on public.survey_assignments;
create policy "Employees can view their own assignments"
  on public.survey_assignments for select
  using (employee_user_id = auth.uid());

-- Needed for account data deletion (deleteMyData).
drop policy if exists "Employees can delete their own assignments" on public.survey_assignments;
create policy "Employees can delete their own assignments"
  on public.survey_assignments for delete
  using (employee_user_id = auth.uid());

drop policy if exists "Employees can submit their own response" on public.survey_responses;
create policy "Employees can submit their own response"
  on public.survey_responses for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.survey_assignments sa
      where sa.survey_id = survey_responses.survey_id and sa.employee_user_id = auth.uid()
    )
  );

drop policy if exists "Employees can view their own response" on public.survey_responses;
create policy "Employees can view their own response"
  on public.survey_responses for select
  using (user_id = auth.uid());

-- Needed for account data deletion (deleteMyData) — a user can withdraw
-- their own anonymous response.
drop policy if exists "Employees can delete their own response" on public.survey_responses;
create policy "Employees can delete their own response"
  on public.survey_responses for delete
  using (user_id = auth.uid());

-- Response count alone (no content) is safe to expose directly to admins —
-- every survey tool shows "3 of 10 responded" regardless of anonymity
-- threshold, since a completion count doesn't reveal who said what.
create or replace function public.get_survey_response_count(p_survey_id uuid)
returns int
language sql
security definer
set search_path = public
stable
as $$
  select case
    when public.is_org_admin((select organization_id from public.surveys where id = p_survey_id))
    then (select count(*)::int from public.survey_responses where survey_id = p_survey_id)
    else null
  end;
$$;

-- Returns raw answer blobs with user_id stripped out — never who said what,
-- and nothing at all below 3 responses. All the actual per-question math
-- (averages, option counts) happens in application code from this
-- anonymized array, not in SQL.
create or replace function public.get_survey_response_values(p_survey_id uuid)
returns setof jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_org_id uuid;
begin
  select organization_id into v_org_id from public.surveys where id = p_survey_id;
  if v_org_id is null or not public.is_org_admin(v_org_id) then
    return;
  end if;

  if (select count(*) from public.survey_responses where survey_id = p_survey_id) < 3 then
    return;
  end if;

  return query
    select answers from public.survey_responses where survey_id = p_survey_id order by random();
end;
$$;
