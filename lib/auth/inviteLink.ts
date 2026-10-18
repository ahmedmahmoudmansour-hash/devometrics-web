// The sign-up link in an invitation email. When the invitation row's id is
// known it is added as `invite`, so the sign-up page can recognise a person who
// was invited by their company and skip the platform-wide invite code (0201).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isInviteToken(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function buildSignupLink(email: string, inviteId?: string | null): string {
  const base = `https://devometrics.com/signup?email=${encodeURIComponent(email)}`;
  return isInviteToken(inviteId) ? `${base}&invite=${encodeURIComponent(inviteId)}` : base;
}
