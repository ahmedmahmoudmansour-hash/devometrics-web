-- People often prefer more than one learning format (e.g. video courses AND
-- hands-on projects), so this becomes a list instead of a single choice.
-- Renamed (not just retyped) to make the plural intent unambiguous at every
-- call site, not just in the database.
alter table public.profiles rename column learning_preference to learning_preferences;

alter table public.profiles
  alter column learning_preferences type text[]
  using case
    when learning_preferences is null or learning_preferences = '' then '{}'::text[]
    else array[learning_preferences]
  end;

alter table public.profiles
  alter column learning_preferences set default '{}'::text[];

update public.profiles set learning_preferences = '{}'::text[] where learning_preferences is null;

alter table public.profiles
  alter column learning_preferences set not null;
