-- 0196 -- Public chatbot: a rate limit that holds across server instances, plus
-- a ceiling on total use (pre-rollout audit 2026-10-08). /api/platform-chat is
-- unauthenticated and calls the paid AI API; its only limit was an in-memory
-- counter inside each server process, which resets on every restart and is not
-- shared between instances, and there was no overall ceiling at all.
--
-- platform_chat_allow(p_key) records one request and says whether it may
-- proceed. p_key is a hash of the visitor's IP computed by the app (no raw IP
-- addresses are stored). Limits, all over a sliding window:
--   - 8 per minute and 40 per hour per visitor
--   - 300 per hour in total, for the whole chatbot
-- A refused request is not recorded (so being refused never extends a lockout).
-- Records older than a day are deleted as part of each call.
--
-- The app keeps its in-memory limiter as a first, cheap layer and allows the
-- request if this function is unreachable, so a database problem cannot take
-- the chatbot down. Callers with the public key can invoke the function
-- directly; the worst they can do is consume their own key's allowance or the
-- shared hourly total (which would make the chatbot say "try again later" --
-- the same effect as simply sending that many chat messages).
--
-- Depends on 0190 (functions are private by default: granted explicitly here).

create table if not exists public.platform_chat_hits (
  id bigint generated always as identity primary key,
  visitor_key text not null check (char_length(visitor_key) <= 128),
  created_at timestamptz not null default now()
);

alter table public.platform_chat_hits enable row level security;
-- No policies: nobody reads or writes this table directly; only the function below.
revoke all on public.platform_chat_hits from anon, authenticated;

create index if not exists platform_chat_hits_created_idx on public.platform_chat_hits (created_at);
create index if not exists platform_chat_hits_visitor_idx on public.platform_chat_hits (visitor_key, created_at);

create or replace function public.platform_chat_allow(p_key text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_key is null or char_length(p_key) = 0 or char_length(p_key) > 128 then
    return false;
  end if;

  delete from public.platform_chat_hits where created_at < now() - interval '1 day';

  if (select count(*) from public.platform_chat_hits
      where visitor_key = p_key and created_at > now() - interval '1 minute') >= 8
     or (select count(*) from public.platform_chat_hits
         where visitor_key = p_key and created_at > now() - interval '1 hour') >= 40
     or (select count(*) from public.platform_chat_hits
         where created_at > now() - interval '1 hour') >= 300 then
    return false;
  end if;

  insert into public.platform_chat_hits (visitor_key) values (p_key);
  return true;
end;
$$;

revoke all on function public.platform_chat_allow(text) from public;
grant execute on function public.platform_chat_allow(text) to anon, authenticated, service_role;
