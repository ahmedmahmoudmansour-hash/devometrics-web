-- 0202: a person's name, in English and Arabic, on a chart position.
--
-- A structural node on the org chart (a box such as "Director") had only a
-- title, so there was nowhere to say who sits in it unless that person already
-- had an account. holder_name / holder_name_ar are optional text shown on the
-- card. They are labels only: they do not create an account, a member row or
-- any access. A real employee still joins through an invitation.
--
-- org_positions is already admin-only (0199); new columns inherit that.
-- Idempotent: safe to run more than once.

alter table public.org_positions
  add column if not exists holder_name text,
  add column if not exists holder_name_ar text;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'org_positions'
      and constraint_name = 'org_positions_holder_name_length_check'
  ) then
    alter table public.org_positions
      add constraint org_positions_holder_name_length_check
      check (
        (holder_name is null or char_length(holder_name) <= 200)
        and (holder_name_ar is null or char_length(holder_name_ar) <= 200)
      );
  end if;
end $$;
