-- 0195 -- Contact form: the database enforces the limits, not just the server
-- action (pre-rollout audit 2026-10-08, CONFIRMED live: the public anon key
-- could POST straight to /rest/v1/contact_inquiries, skipping the form's
-- honeypot and rate limit entirely -- a 20,000-character message and a row with
-- an invalid email were both stored with HTTP 201, with no ceiling on volume).
--
-- 1. Direct inserts are closed: the "Anyone can submit" policy is dropped and
--    INSERT is revoked from anon/authenticated.
-- 2. public.submit_contact_inquiry(type, name, email, message) is the only way
--    in. It validates (type, required fields, lengths, email shape) and caps
--    volume IN THE DATABASE: 3 per email address per hour, 100 per hour in
--    total. Errors are prefixed "contact:" so the app can tell a refused
--    submission from an outage.
-- 3. Length CHECKs as a backstop for any other writer (NOT VALID: they apply
--    to new rows and don't fail on rows already stored).
-- 4. Removes the two clearly-labelled test rows the audit created.
--
-- Limits of this: someone holding the public key can still call the function
-- directly, but is now bounded to 100 rows/hour, and the notification email is
-- only sent by the app, so direct calls cannot spam the sales/support inboxes.
-- A determined attacker can use up the hourly total and make the form say "try
-- again later" for everyone else; the limit is deliberately generous and the
-- inquiry address stays published as a fallback.
--
-- Depends on 0055 (contact_inquiries), 0056 (admin read policy -- unchanged),
-- 0190 (functions are private by default: this file grants explicitly).

drop policy if exists "Anyone can submit a contact inquiry" on public.contact_inquiries;
revoke insert on public.contact_inquiries from anon, authenticated;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'contact_inquiries'
      and constraint_name = 'contact_inquiries_name_len'
  ) then
    alter table public.contact_inquiries
      add constraint contact_inquiries_name_len check (char_length(name) <= 200) not valid;
  end if;
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'contact_inquiries'
      and constraint_name = 'contact_inquiries_email_len'
  ) then
    alter table public.contact_inquiries
      add constraint contact_inquiries_email_len check (char_length(email) <= 254) not valid;
  end if;
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'contact_inquiries'
      and constraint_name = 'contact_inquiries_message_len'
  ) then
    alter table public.contact_inquiries
      add constraint contact_inquiries_message_len check (char_length(message) <= 5000) not valid;
  end if;
end $$;

create index if not exists contact_inquiries_created_idx on public.contact_inquiries (created_at desc);
create index if not exists contact_inquiries_email_created_idx on public.contact_inquiries (lower(email), created_at desc);

create or replace function public.submit_contact_inquiry(
  p_type text,
  p_name text,
  p_email text,
  p_message text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := regexp_replace(btrim(coalesce(p_name, '')), '[\r\n\t]+', ' ', 'g');
  v_email text := btrim(coalesce(p_email, ''));
  v_message text := btrim(coalesce(p_message, ''));
begin
  if p_type is null or p_type not in ('sales', 'support', 'careers') then
    raise exception 'contact:invalid_type';
  end if;
  if v_name = '' or v_email = '' or v_message = '' then
    raise exception 'contact:missing_fields';
  end if;
  if char_length(v_name) > 200 or char_length(v_email) > 254 or char_length(v_message) > 5000 then
    raise exception 'contact:too_long';
  end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'contact:invalid_email';
  end if;

  if (select count(*) from public.contact_inquiries
      where lower(email) = lower(v_email) and created_at > now() - interval '1 hour') >= 3
     or (select count(*) from public.contact_inquiries
         where created_at > now() - interval '1 hour') >= 100 then
    raise exception 'contact:rate_limited';
  end if;

  insert into public.contact_inquiries (type, name, email, message)
  values (p_type, v_name, v_email, v_message);
  return true;
end;
$$;

revoke all on function public.submit_contact_inquiry(text, text, text, text) from public;
grant execute on function public.submit_contact_inquiry(text, text, text, text) to anon, authenticated, service_role;

-- Audit test rows (labelled; nothing real is named like this).
delete from public.contact_inquiries where name like 'AUDIT TEST%' or message like 'AUDIT TEST%';
