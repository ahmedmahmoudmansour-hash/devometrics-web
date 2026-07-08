-- Profiles: one row per authenticated user
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Development plans: one user can have multiple plans over time
create table if not exists public.development_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now()
);

alter table public.development_plans enable row level security;

create policy "Users can manage their own plans"
  on public.development_plans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Milestones: individual, markable steps within a plan
create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.development_plans (id) on delete cascade,
  title text not null,
  description text,
  target_date date,
  position integer not null default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.milestones enable row level security;

create policy "Users can manage milestones on their own plans"
  on public.milestones for all
  using (
    exists (
      select 1 from public.development_plans p
      where p.id = milestones.plan_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.development_plans p
      where p.id = milestones.plan_id and p.user_id = auth.uid()
    )
  );
