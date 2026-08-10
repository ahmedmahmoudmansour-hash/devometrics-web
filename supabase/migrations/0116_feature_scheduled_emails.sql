-- Feature-level ad-hoc email compose & send — one shared engine reused by
-- Knowledge Hub, Impact Cycles (Performance Reviews), Surveys, and
-- Assessments, replacing the "only fixed-template, auto-triggered emails"
-- pattern those four features were limited to before. One table serves
-- three jobs at once: the send queue (a row with sent_at null and
-- send_at in the future), the immediate-send record (sent_at set the
-- moment it's sent), and the send-history log (every row, forever) — all
-- the same rows, just read differently depending on what's being shown.

create table if not exists public.feature_scheduled_emails (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  feature_key text not null check (feature_key in ('knowledge_hub', 'performance_review', 'survey', 'assessment')),
  subject text not null,
  message text not null,
  recipient_user_ids uuid[] not null,
  send_at timestamptz not null default now(),
  sent_at timestamptz,
  sent_count integer,
  failed_count integer,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists feature_scheduled_emails_org_idx
  on public.feature_scheduled_emails (organization_id, feature_key, created_at desc);
-- Partial index scoped to exactly what the cron sweep queries — a table
-- that accumulates years of history never makes that lookup slower.
create index if not exists feature_scheduled_emails_due_idx
  on public.feature_scheduled_emails (send_at)
  where sent_at is null;

alter table public.feature_scheduled_emails enable row level security;

drop policy if exists "Org admins manage their feature scheduled emails" on public.feature_scheduled_emails;
create policy "Org admins manage their feature scheduled emails"
  on public.feature_scheduled_emails for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

-- Cron-side read: same secret-gated SECURITY DEFINER pattern every due_*
-- reminder function already uses (0054/0101) — the cron route has no user
-- session at all, so RLS can't be the gate here; the secret comparison
-- inside the function is. Returns nothing (not an error) on a wrong
-- secret, same as every sibling due_* function.
--
-- Recipient email/name are resolved and returned INLINE (a jsonb array),
-- not left as raw recipient_user_ids for the route to look up afterward —
-- the route's own supabase client has no session in a cron context, so a
-- separate .from("profiles") read from there would just hit RLS and
-- return nothing. Every due_* reminder function in this schema does the
-- same thing for the same reason.
create or replace function public.due_scheduled_feature_emails(secret text)
returns table (
  id uuid,
  organization_id uuid,
  feature_key text,
  subject text,
  message text,
  recipients jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select
    e.id,
    e.organization_id,
    e.feature_key,
    e.subject,
    e.message,
    coalesce(
      (select jsonb_agg(jsonb_build_object('email', p.email, 'fullName', p.full_name))
       from public.profiles p
       where p.id = any(e.recipient_user_ids) and p.email is not null),
      '[]'::jsonb
    ) as recipients
  from public.feature_scheduled_emails e
  where e.sent_at is null
    and e.send_at <= now()
    and secret = (select value from public.app_secrets where key = 'cron_secret');
$$;

revoke all on function public.due_scheduled_feature_emails(text) from public;
grant execute on function public.due_scheduled_feature_emails(text) to authenticated;

create or replace function public.mark_scheduled_feature_email_sent(
  secret text,
  target_id uuid,
  p_sent_count integer,
  p_failed_count integer
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.feature_scheduled_emails
  set sent_at = now(), sent_count = p_sent_count, failed_count = p_failed_count
  where id = target_id
    and secret = (select value from public.app_secrets where key = 'cron_secret');
$$;

revoke all on function public.mark_scheduled_feature_email_sent(text, uuid, integer, integer) from public;
grant execute on function public.mark_scheduled_feature_email_sent(text, uuid, integer, integer) to authenticated;
