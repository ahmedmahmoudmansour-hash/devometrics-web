-- Live calendar subscription feed: Outlook/Google subscribe to a per-user
-- ICS URL and the user's Devometrics tasks + milestone deadlines appear in
-- their own calendar automatically (one-way sync, no OAuth).
--
-- The feed is fetched by Outlook/Google servers with no Supabase session,
-- and this app deliberately has no service-role key — so access goes
-- through a security-definer function gated on a long random per-user
-- token, the same trust pattern as the billing webhook RPC (0044). The
-- token IS the credential: 64 hex chars, revocable by regenerating.

alter table public.profiles
  add column if not exists calendar_feed_token text unique;

create or replace function public.calendar_feed(feed_token text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'tasks',
    coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', t.id, 'title', t.title, 'date', t.date, 'time', t.time, 'completed', t.completed
        ) order by t.date)
        from public.personal_tasks t
        join public.profiles p on p.id = t.user_id
        where p.calendar_feed_token = feed_token
          and t.date >= (current_date - interval '30 days')
      ),
      '[]'::jsonb
    ),
    'milestones',
    coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', m.id, 'title', m.title, 'date', m.target_date, 'completed', m.completed
        ) order by m.target_date)
        from public.milestones m
        join public.development_plans dp on dp.id = m.plan_id
        join public.profiles p on p.id = dp.user_id
        where p.calendar_feed_token = feed_token
          and m.target_date is not null
      ),
      '[]'::jsonb
    )
  )
  -- Token must exist and be plausibly long — a null/short token never
  -- matches anything, so this function can't be enumerated cheaply.
  where feed_token is not null
    and length(feed_token) >= 32
    and exists (select 1 from public.profiles where calendar_feed_token = feed_token);
$$;

revoke all on function public.calendar_feed(text) from public;
grant execute on function public.calendar_feed(text) to anon, authenticated;
