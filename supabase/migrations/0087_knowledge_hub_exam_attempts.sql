-- 0087: Knowledge Hub exam attempt limits + longer retry cooldown
--
-- Adds an admin-configurable max_attempts cap per exam-type content item
-- (null = unlimited, admin sets it per document). Replaces the previous
-- 60-second anti-double-submit cooldown in submit_knowledge_hub_exam with a
-- 2-hour cooldown — long enough to actually encourage re-reading the
-- material before retrying, not just prevent an accidental double-click.
-- Also returns the attempt number so the client can compute "attempts
-- remaining" against max_attempts without an extra round-trip.
--
-- Depends on 0084 (knowledge_hub_content, submit_knowledge_hub_exam).

alter table public.knowledge_hub_content
  add column if not exists max_attempts integer;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'knowledge_hub_content'
      and constraint_name = 'knowledge_hub_content_max_attempts_check'
  ) then
    alter table public.knowledge_hub_content
      add constraint knowledge_hub_content_max_attempts_check
      check (max_attempts is null or max_attempts > 0);
  end if;
end $$;

-- Return type is changing (new attempt_number column), so this must be
-- dropped before it's recreated — CREATE OR REPLACE FUNCTION cannot alter
-- an existing function's return type.
drop function if exists public.submit_knowledge_hub_exam(uuid, jsonb);

create function public.submit_knowledge_hub_exam(p_content_id uuid, p_answers jsonb)
returns table(score_percent integer, passed boolean, attempt_number integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_correct integer;
  v_passing integer;
  v_max_attempts integer;
  v_prior_attempts integer;
  v_score integer;
  v_passed boolean;
begin
  if not exists (
    select 1 from public.knowledge_hub_assignments
    where content_id = p_content_id and employee_user_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  select passing_score_percent, max_attempts into v_passing, v_max_attempts
  from public.knowledge_hub_content
  where id = p_content_id and completion_type = 'exam';

  if v_passing is null then
    raise exception 'This content does not have an exam';
  end if;

  select count(*) into v_prior_attempts
  from public.knowledge_hub_completions
  where content_id = p_content_id and employee_user_id = auth.uid() and method = 'exam';

  if v_max_attempts is not null and v_prior_attempts >= v_max_attempts then
    raise exception 'You have used all % attempts for this exam — contact your admin.', v_max_attempts;
  end if;

  if exists (
    select 1 from public.knowledge_hub_completions
    where content_id = p_content_id and employee_user_id = auth.uid()
      and completed_at > now() - interval '2 hours'
  ) then
    raise exception 'Please review the material again before retrying — you can retake this exam 2 hours after your last attempt.';
  end if;

  select count(*) into v_total
  from public.knowledge_hub_exam_questions
  where content_id = p_content_id;

  if v_total = 0 then
    raise exception 'No questions found for this exam';
  end if;

  select count(distinct q.id) into v_correct
  from public.knowledge_hub_exam_questions q
  join public.knowledge_hub_exam_answer_keys k on k.question_id = q.id
  join jsonb_to_recordset(p_answers) as a(question_id uuid, selected_index integer)
    on a.question_id = q.id and a.selected_index = k.correct_index
  where q.content_id = p_content_id;

  v_score := round((v_correct::numeric / v_total::numeric) * 100);
  v_passed := v_score >= v_passing;

  insert into public.knowledge_hub_completions
    (content_id, employee_user_id, method, score_percent, passed, answers, completed_at)
  values
    (p_content_id, auth.uid(), 'exam', v_score, v_passed, p_answers, now());

  return query select v_score, v_passed, v_prior_attempts + 1;
end;
$$;

revoke all on function public.submit_knowledge_hub_exam(uuid, jsonb) from public;
grant execute on function public.submit_knowledge_hub_exam(uuid, jsonb) to authenticated;
