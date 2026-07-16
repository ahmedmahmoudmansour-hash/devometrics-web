-- Surfaces Big Five to enterprise admins — but personality data is more
-- sensitive than skill/competency data under real HR data-protection
-- practice (SIOP Principles, GDPR profiling provisions both call for
-- explicit consent before an employer sees psychological assessment
-- results, distinct from general job-performance data). Unlike every other
-- admin-visibility policy in this app (gap analyses, assessment results,
-- career health snapshots — all visible to admins automatically once
-- someone joins an org), this one is opt-in and defaults OFF, enforced at
-- the RLS layer itself, not just hidden in the UI.
alter table public.profiles
  add column if not exists share_big_five_with_admin boolean not null default false;

drop policy if exists "Org admins can view opted-in members' big five profiles" on public.big_five_profiles;
create policy "Org admins can view opted-in members' big five profiles"
  on public.big_five_profiles for select
  using (
    public.is_org_admin_of_user(user_id)
    and exists (
      select 1 from public.profiles p
      where p.id = user_id and p.share_big_five_with_admin = true
    )
  );
