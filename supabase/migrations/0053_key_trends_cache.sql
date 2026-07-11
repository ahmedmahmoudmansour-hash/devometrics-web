-- Key Trends previously re-ran a full multi-search web-search agent loop
-- (up to 10 real searches) on EVERY click, even for a job title someone
-- already searched minutes earlier — that loop, not the LLM call itself, is
-- what made it feel slow. Trends genuinely don't change day to day, so a
-- shared cache turns every repeat lookup (across ALL users, not just the
-- same one) into a near-instant read instead of a fresh search.
--
-- Shared, non-sensitive data — no per-user ownership to restrict, and this
-- app has no service-role key to bypass RLS from the server, so any
-- authenticated user can read/write cache rows (matching the auth.uid() is
-- not null pattern already used for "any signed-in user" elsewhere).
create table if not exists public.key_trends_cache (
  job_title_key text primary key,
  job_title text not null,
  summary text not null,
  generated_at timestamptz not null default now()
);

alter table public.key_trends_cache enable row level security;

drop policy if exists "Authenticated users can read trend cache" on public.key_trends_cache;
create policy "Authenticated users can read trend cache"
  on public.key_trends_cache for select
  using (auth.uid() is not null);

drop policy if exists "Authenticated users can write trend cache" on public.key_trends_cache;
create policy "Authenticated users can write trend cache"
  on public.key_trends_cache for insert
  with check (auth.uid() is not null);

drop policy if exists "Authenticated users can refresh trend cache" on public.key_trends_cache;
create policy "Authenticated users can refresh trend cache"
  on public.key_trends_cache for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
