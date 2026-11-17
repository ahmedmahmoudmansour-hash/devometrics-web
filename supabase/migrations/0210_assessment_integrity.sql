-- 0210: a record of the conditions each assessment was taken under.
--
-- For every sitting of an assessment: that the person made the "I answer myself, without AI tools" promise, when they started (the
-- database's clock, not their device's), how long they were given, how many times they left the page and for how long in total,
-- whether they finished in time, and a short summary of how their written answers were typed. The person's manager and company
-- admins can read it next to the result; it is a set of signals for a conversation, never proof.
--
-- One row per sitting: (person, kind, subject_key). subject_key is the assessment or check id, or "slug:sitting id" for tests that
-- have no row of their own (cognitive reasoning, English proficiency).
--
-- Rules (enforced here, so they hold even if the application's checks are bypassed):
--   * a person writes only their own rows, and only in a company they belong to (or with no company at all)
--   * the start time is always the database's clock at insert; nothing else is accepted at insert
--   * afterwards a person can only: record the promise once, add to the leave counters (never lower them, at most 50 at a time),
--     replace the typing summary, and finish once. Finishing sets the finish time and works out "late" on the database's clock.
--   * managers and company admins can read; nobody can delete (rows go when the person or company is deleted)
-- Uses existing helpers: is_org_member (0204), is_org_admin (0016), is_manager_of_user (0078/0172). Safe to run more than once.
-- To undo: supabase/ROLLBACK_0210.sql.

create table if not exists public.assessment_integrity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  employee_user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('role', 'knowledge_check', 'cognitive', 'english', 'case_study')),
  subject_key text not null check (char_length(subject_key) between 1 and 120),
  attested_at timestamptz,
  started_at timestamptz not null default now(),
  time_limit_seconds integer check (time_limit_seconds is null or time_limit_seconds between 30 and 36000),
  left_page_count integer not null default 0 check (left_page_count between 0 and 999),
  away_seconds integer not null default 0 check (away_seconds between 0 and 86400),
  typing jsonb not null default '{}'::jsonb check (jsonb_typeof(typing) = 'object'),
  finished_at timestamptz,
  late boolean,
  unique (employee_user_id, kind, subject_key)
);

create index if not exists assessment_integrity_org_idx on public.assessment_integrity (organization_id, started_at desc);

alter table public.assessment_integrity enable row level security;

drop policy if exists "Read assessment integrity" on public.assessment_integrity;
create policy "Read assessment integrity"
  on public.assessment_integrity for select
  using (
    employee_user_id = auth.uid()
    or public.is_manager_of_user(employee_user_id)
    or (organization_id is not null and public.is_org_admin(organization_id))
  );

drop policy if exists "Record own assessment integrity" on public.assessment_integrity;
create policy "Record own assessment integrity"
  on public.assessment_integrity for insert
  with check (
    employee_user_id = auth.uid()
    and (organization_id is null or public.is_org_member(organization_id))
  );

drop policy if exists "Update own open assessment integrity" on public.assessment_integrity;
create policy "Update own open assessment integrity"
  on public.assessment_integrity for update
  using (employee_user_id = auth.uid() and finished_at is null)
  with check (employee_user_id = auth.uid());

-- At insert: the database decides the start time and nothing can be pre-loaded.
create or replace function public.assessment_integrity_before_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.started_at := now();
  new.left_page_count := 0;
  new.away_seconds := 0;
  new.finished_at := null;
  new.late := null;
  return new;
end;
$$;

-- At update: only the allowed columns may move, and only in the allowed direction.
create or replace function public.assessment_integrity_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.finished_at is not null then
    raise exception 'A finished sitting cannot be changed' using errcode = '23514';
  end if;
  if new.id is distinct from old.id
     or new.organization_id is distinct from old.organization_id
     or new.employee_user_id is distinct from old.employee_user_id
     or new.kind is distinct from old.kind
     or new.subject_key is distinct from old.subject_key
     or new.started_at is distinct from old.started_at
     or new.time_limit_seconds is distinct from old.time_limit_seconds then
    raise exception 'Only the counters, the promise, the typing summary and finishing can change' using errcode = '23514';
  end if;
  if old.attested_at is not null and new.attested_at is distinct from old.attested_at then
    raise exception 'The promise cannot be changed' using errcode = '23514';
  end if;
  if new.attested_at is not null and old.attested_at is null then
    new.attested_at := now();
  end if;
  if new.left_page_count < old.left_page_count or new.left_page_count > old.left_page_count + 50
     or new.away_seconds < old.away_seconds or new.away_seconds > old.away_seconds + 7200 then
    raise exception 'The leave counters can only go up, a little at a time' using errcode = '23514';
  end if;
  if new.finished_at is not null then
    new.finished_at := now();
    new.late := case
      when old.time_limit_seconds is null then false
      else now() > old.started_at + make_interval(secs => old.time_limit_seconds + 60)
    end;
  else
    new.late := null;
  end if;
  return new;
end;
$$;

drop trigger if exists assessment_integrity_insert_trg on public.assessment_integrity;
create trigger assessment_integrity_insert_trg
  before insert on public.assessment_integrity
  for each row execute function public.assessment_integrity_before_insert();

drop trigger if exists assessment_integrity_guard_trg on public.assessment_integrity;
create trigger assessment_integrity_guard_trg
  before update on public.assessment_integrity
  for each row execute function public.assessment_integrity_guard();
