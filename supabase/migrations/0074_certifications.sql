-- Certification/credential tracker with expiry reminders — individual-
-- experience feature. Deliberately a NEW table, not an extension of
-- profiles.qualifications (migration from extractCareerProfile): that jsonb
-- array is CV-extracted history with no expiry concept and isn't meant to
-- be a live-maintained list. This table is the user's own upkeep tool —
-- expiry_date is nullable since plenty of credentials (a degree) never
-- expire and shouldn't force a fake date.
create table if not exists public.certifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_name text not null,
  issuer text,
  credential_id text,
  credential_url text,
  issued_date date,
  expiry_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.certifications enable row level security;

drop policy if exists "Users can manage their own certifications" on public.certifications;
create policy "Users can manage their own certifications"
  on public.certifications for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists certifications_user_expiry_idx on public.certifications (user_id, expiry_date);

-- Same cron + security-definer + shared-secret pattern as due_task_reminders
-- (0054) — this app has no service-role key, so a cron request can't read
-- across every user's certifications through normal RLS. Kept as its own
-- function/column/route rather than folded into due_task_reminders: mixing
-- "tasks due" and "certs expiring" into one jsonb shape would make both
-- emails muddier, and a weekly-feeling cadence (below) is the right nudge
-- frequency for an expiry 30 days out, not the daily one tasks use.
alter table public.profiles
  add column if not exists last_certification_reminder_sent_at timestamptz;

create or replace function public.due_certification_reminders(secret text)
returns table(user_id uuid, email text, full_name text, certifications jsonb)
language sql
security definer
set search_path = public
as $$
  select p.id, p.email, p.full_name,
    jsonb_agg(
      jsonb_build_object(
        'name', c.credential_name,
        'issuer', c.issuer,
        'expiry_date', c.expiry_date,
        'expired', c.expiry_date < current_date
      )
      order by c.expiry_date
    )
  from public.certifications c
  join public.profiles p on p.id = c.user_id
  where secret = (select value from public.app_secrets where key = 'cron_secret')
    and c.expiry_date is not null
    and c.expiry_date <= current_date + interval '30 days'
    and p.email is not null
    and (p.last_certification_reminder_sent_at is null or p.last_certification_reminder_sent_at < current_date - interval '6 days')
  group by p.id, p.email, p.full_name;
$$;

revoke all on function public.due_certification_reminders(text) from public;
grant execute on function public.due_certification_reminders(text) to anon, authenticated;

create or replace function public.mark_certification_reminder_sent(secret text, target_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set last_certification_reminder_sent_at = now()
  where id = target_user_id
    and secret = (select value from public.app_secrets where key = 'cron_secret');
$$;

revoke all on function public.mark_certification_reminder_sent(text, uuid) from public;
grant execute on function public.mark_certification_reminder_sent(text, uuid) to anon, authenticated;
