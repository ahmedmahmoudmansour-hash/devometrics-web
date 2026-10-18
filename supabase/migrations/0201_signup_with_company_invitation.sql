-- 0201: let a person invited by their company sign up without the platform invite code.
--
-- Sign-up is gated by one shared platform code while the app is invite-only.
-- That gate also stopped employees whose company had already invited them by
-- email: they cannot be given a code they do not have. The invitation email now
-- carries the invitation's own id (a random uuid, 122 bits) in the link, and the
-- sign-up page asks this function whether that id is an unused invitation for
-- the email being signed up.
--
-- Why an id and not just the email: a function that answers "is this email
-- invited?" can be called by anyone to learn which addresses a company has
-- invited. Needing the random id as well makes that impossible to enumerate.
-- Someone who already holds the id (it is in the person's own inbox) learns
-- nothing they did not have.
--
-- It returns true or false and never throws, so a bad value cannot break the
-- sign-up page. Account ownership is still proven by the confirmation email,
-- and the existing checkAndConsumeInvite() still decides what the person joins.
--
-- Idempotent: safe to run more than once.

create or replace function public.signup_invite_is_valid(p_invite_id uuid, p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if p_invite_id is null or p_email is null or btrim(p_email) = '' then
    return false;
  end if;
  return exists (
    select 1
    from public.organization_invites oi
    where oi.id = p_invite_id
      and lower(oi.email) = lower(btrim(p_email))
      and oi.accepted_at is null
  );
exception when others then
  return false;
end;
$$;

revoke all on function public.signup_invite_is_valid(uuid, text) from public;
grant execute on function public.signup_invite_is_valid(uuid, text) to anon, authenticated;
