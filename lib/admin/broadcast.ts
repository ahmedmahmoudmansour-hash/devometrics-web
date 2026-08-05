"use server";

import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";
import { renderEmail, escapeHtml } from "@/lib/email/template";

// Platform-wide announcement email — distinct from every other email sender
// in this app, which are all org-scoped (organization_email_messages) or
// single-recipient transactional notices. This is the one place that sends
// the same message to every registered user across the whole platform, so
// it's admin-gated the same way buildPilotRows() is (is_admin = true on the
// caller's own profile — there is no service-role key in this app, so this
// relies entirely on the "Admins can view all X" RLS policy from migration
// 0013), and it defaults to a test-only send to the admin's own address
// rather than ever defaulting to "send to everyone."

function renderAnnouncementHtml(firstName: string, subject: string, message: string, ctaUrl: string, ctaLabel: string): string {
  const paragraphs = message
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="font-size:15px;line-height:1.7;margin:0 0 16px;">${escapeHtml(p).replace(/\n/g, "<br />")}</p>`)
    .join("");

  return renderEmail({
    preheader: subject,
    footerNote: "You're getting this because you have a Devometrics account.",
    bodyHtml: `
      <h2 style="color:#0A0F1E;font-size:20px;margin:0 0 16px;">Hi ${escapeHtml(firstName)},</h2>
      ${paragraphs}
      <p style="margin:24px 0 0;">
        <a href="${ctaUrl}" style="background:#00C9A7;color:#0A0F1E;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px;display:inline-block;font-size:14px;">${escapeHtml(ctaLabel)} →</a>
      </p>
    `,
  });
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, full_name, email")
    .eq("id", user.id)
    .single<{ is_admin: boolean; full_name: string | null; email: string | null }>();
  if (!profile?.is_admin) return { supabase, user: null, error: "Not authorized" };

  return { supabase, user: { id: user.id, name: profile.full_name, email: profile.email }, error: null };
}

// Sends only to the calling admin's own address — always available with no
// confirmation step, since it can't reach anyone else.
export async function sendAnnouncementTestEmail(
  subject: string,
  message: string,
  ctaUrl: string,
  ctaLabel: string
): Promise<{ success: true } | { error: string }> {
  const { user, error } = await requireAdmin();
  if (error || !user) return { error: error ?? "Not authorized" };
  if (!user.email) return { error: "Your own profile has no email on file" };
  if (!subject.trim() || !message.trim()) return { error: "Subject and message are required" };

  try {
    await sendEmail(
      user.email,
      `[TEST] ${subject}`,
      renderAnnouncementHtml(user.name?.trim().split(/\s+/)[0] ?? "there", subject, message, ctaUrl, ctaLabel)
    );
    return { success: true };
  } catch (err) {
    console.error("sendAnnouncementTestEmail failed:", err);
    return { error: "Couldn't send the test email — try again in a moment." };
  }
}

// Returns the live platform-wide recipient count so the confirm step can
// show a real number, not a stale one from when the page first loaded.
export async function countAnnouncementRecipients(): Promise<number | null> {
  const { user, error } = await requireAdmin();
  if (error || !user) return null;
  const supabase = await createClient();
  const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true }).not("email", "is", null);
  return count ?? 0;
}

export type AnnouncementRecipient = { id: string; name: string; email: string };

// Full id/name/email list for the "choose specific users" picker — same
// admin-gated query as countAnnouncementRecipients, just with rows instead
// of a count.
export async function listAnnouncementRecipients(): Promise<AnnouncementRecipient[]> {
  const { user, error } = await requireAdmin();
  if (error || !user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .not("email", "is", null)
    .order("full_name", { ascending: true })
    .returns<{ id: string; full_name: string | null; email: string }[]>();
  return (data ?? []).map((p) => ({ id: p.id, name: p.full_name?.trim() || p.email, email: p.email }));
}

// Same as sendAnnouncementToAllUsers but scoped to an explicit id list —
// used by the "choose specific users" picker instead of "send to
// everyone." Looks up name/email fresh server-side rather than trusting
// whatever the client last rendered, so a stale picker selection can't
// silently email the wrong address.
export async function sendAnnouncementToSelectedUsers(
  userIds: string[],
  subject: string,
  message: string,
  ctaUrl: string,
  ctaLabel: string
): Promise<{ success: true; sent: number; failed: number } | { error: string }> {
  const { user, error } = await requireAdmin();
  if (error || !user) return { error: error ?? "Not authorized" };
  if (!subject.trim() || !message.trim()) return { error: "Subject and message are required" };
  if (userIds.length === 0) return { error: "Select at least one recipient" };

  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("full_name, email")
    .in("id", userIds)
    .not("email", "is", null)
    .returns<{ full_name: string | null; email: string | null }[]>();

  const recipients = (profiles ?? []).filter((p): p is { full_name: string | null; email: string } => !!p.email);
  if (recipients.length === 0) return { error: "No recipients found" };

  const results = await Promise.allSettled(
    recipients.map((r) =>
      sendEmail(
        r.email,
        subject,
        renderAnnouncementHtml(r.full_name?.trim().split(/\s+/)[0] ?? "there", subject, message, ctaUrl, ctaLabel)
      )
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - sent;
  return { success: true, sent, failed };
}

// The real send — every registered user on the platform, one personalized
// email each. Best-effort per recipient (Promise.allSettled, same posture
// as every bulk-assign action in this app): one bad email address doesn't
// abort the batch for everyone else.
export async function sendAnnouncementToAllUsers(
  subject: string,
  message: string,
  ctaUrl: string,
  ctaLabel: string
): Promise<{ success: true; sent: number; failed: number } | { error: string }> {
  const { user, error } = await requireAdmin();
  if (error || !user) return { error: error ?? "Not authorized" };
  if (!subject.trim() || !message.trim()) return { error: "Subject and message are required" };

  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("full_name, email")
    .not("email", "is", null)
    .returns<{ full_name: string | null; email: string | null }[]>();

  const recipients = (profiles ?? []).filter((p): p is { full_name: string | null; email: string } => !!p.email);
  if (recipients.length === 0) return { error: "No recipients found" };

  const results = await Promise.allSettled(
    recipients.map((r) =>
      sendEmail(
        r.email,
        subject,
        renderAnnouncementHtml(r.full_name?.trim().split(/\s+/)[0] ?? "there", subject, message, ctaUrl, ctaLabel)
      )
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - sent;
  return { success: true, sent, failed };
}
