-- User-authored roleplay scenarios, alongside the fixed built-in ones in
-- lib/roleplay/scenarios.ts. Same shape (setup/role/opening message) so the
-- existing RoleplayChat UI and /api/roleplay route can run either kind
-- unchanged — this table just supplies the content instead of the static
-- array. Intended to be a paid-tier feature once billing exists (see
-- billing-gap notes); no gating enforced yet since there's no billing to
-- gate against.
create table if not exists public.custom_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  setup text not null,
  your_role text not null,
  opening_message text not null,
  created_at timestamptz not null default now()
);

alter table public.custom_scenarios enable row level security;

create policy "Users can manage their own custom scenarios"
  on public.custom_scenarios for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists custom_scenarios_user_created_idx
  on public.custom_scenarios (user_id, created_at desc);
