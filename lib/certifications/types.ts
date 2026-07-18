export type Certification = {
  id: string;
  user_id: string;
  credential_name: string;
  issuer: string | null;
  credential_id: string | null;
  credential_url: string | null;
  issued_date: string | null;
  expiry_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ExpiryStatus = "none" | "expired" | "soon" | "ok";

// "soon" = within 60 days — wider than the 30-day email-reminder window on
// purpose: the in-app badge is meant to be the early, low-friction signal
// someone notices while browsing, before it becomes a "your email inbox has
// a warning" situation.
export function expiryStatus(expiryDate: string | null): ExpiryStatus {
  if (!expiryDate) return "none";
  const days = (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (days < 0) return "expired";
  if (days <= 60) return "soon";
  return "ok";
}
