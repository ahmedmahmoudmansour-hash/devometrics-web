-- 0117: Fix duplicate default onboarding templates
--
-- lib/onboarding/actions.ts's getOrCreateDefaultOnboardingTemplate reads
-- the org's one default template via .maybeSingle(), then inserts one if
-- none exists yet. 0102 never added a uniqueness guarantee for "one
-- default template per org," so two page loads racing each other (e.g.
-- while Supabase's PostgREST schema cache was still catching up right
-- after 0102 was first applied) could both see "no existing template" and
-- both insert one, leaving two is_default=true rows for the same org.
-- .maybeSingle() then throws PGRST116 ("multiple (or no) rows returned")
-- on every subsequent read, which the app surfaces as a generic "not
-- migrated" message — indistinguishable from the table genuinely not
-- existing, which is why this looked like a migration failure for so long.
--
-- This dedupes any org that already hit this race (keeping the oldest
-- default template, dropping newer duplicates and their steps via
-- on-delete-cascade) and adds a partial unique index so it can never
-- happen again — a second insert attempt will now fail fast with a real
-- constraint violation instead of silently creating a second row.

delete from public.onboarding_templates t
using (
  select id,
         row_number() over (partition by organization_id order by created_at asc, id asc) as rn
  from public.onboarding_templates
  where is_default = true
) ranked
where t.id = ranked.id
  and ranked.rn > 1;

create unique index if not exists onboarding_templates_one_default_per_org_uidx
  on public.onboarding_templates (organization_id)
  where is_default = true;
