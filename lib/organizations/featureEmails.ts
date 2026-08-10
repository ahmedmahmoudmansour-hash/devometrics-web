"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";
import { renderEmail, escapeHtml } from "@/lib/email/template";
import { type FeatureEmailKey, type FeatureEmailRow } from "@/lib/organizations/featureEmailConstants";

const FEATURE_EMAIL_PAGE_PATH: Record<FeatureEmailKey, string> = {
  knowledge_hub: "/dashboard/company/knowledge-hub",
  performance_review: "/dashboard/company/impact-cycles",
  survey: "/dashboard/company/surveys",
  assessment: "/dashboard/company/employees",
  job_architecture: "/dashboard/company/job-architecture",
  hiring: "/dashboard/company/hiring",
  org_chart: "/dashboard/company/org-chart",
  competency_management: "/dashboard/company/competencies",
  high_potential: "/dashboard/company/high-potential",
  succession: "/dashboard/company/succession",
  scorecard: "/dashboard/company/scorecard",
  exit_interviews: "/dashboard/company/exit-interviews",
  onboarding: "/dashboard/company/onboarding",
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function requireOrgAdmin(organizationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: "Not authenticated" as const };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle<{ role: string }>();
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single<{ is_admin: boolean }>();
  if (membership?.role !== "admin" && !profile?.is_admin) return { supabase, user: null, error: "Not authorized" as const };

  return { supabase, user, error: null };
}

function renderFeatureEmailHtml(firstName: string, subject: string, message: string): string {
  const paragraphs = message
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="font-size:15px;line-height:1.7;margin:0 0 16px;">${escapeHtml(p).replace(/\n/g, "<br />")}</p>`)
    .join("");
  return renderEmail({
    preheader: subject,
    footerNote: "You're getting this because you have a Devometrics account.",
    bodyHtml: `<h2 style="color:#0A0F1E;font-size:20px;margin:0 0 16px;">Hi ${escapeHtml(firstName)},</h2>${paragraphs}`,
  });
}

export async function listFeatureEmailHistory(organizationId: string, featureKey: FeatureEmailKey): Promise<FeatureEmailRow[]> {
  const { supabase, error } = await requireOrgAdmin(organizationId);
  if (error) return [];

  const { data } = await supabase
    .from("feature_scheduled_emails")
    .select("id, subject, message, recipient_user_ids, send_at, sent_at, sent_count, failed_count, created_at")
    .eq("organization_id", organizationId)
    .eq("feature_key", featureKey)
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<
      { id: string; subject: string; message: string; recipient_user_ids: string[]; send_at: string; sent_at: string | null; sent_count: number | null; failed_count: number | null; created_at: string }[]
    >();

  return (data ?? []).map((r) => ({
    id: r.id,
    subject: r.subject,
    message: r.message,
    recipientCount: r.recipient_user_ids?.length ?? 0,
    sendAt: r.send_at,
    sentAt: r.sent_at,
    sentCount: r.sent_count,
    failedCount: r.failed_count,
    createdAt: r.created_at,
  }));
}

async function sendNow(
  supabase: SupabaseServerClient,
  emailId: string,
  subject: string,
  message: string,
  recipients: { userId: string; email: string; name: string }[]
): Promise<void> {
  const results = await Promise.allSettled(
    recipients.map((r) => sendEmail(r.email, subject, renderFeatureEmailHtml(r.name.trim().split(/\s+/)[0] || "there", subject, message)))
  );
  const sentCount = results.filter((r) => r.status === "fulfilled").length;
  const failedCount = results.length - sentCount;
  await supabase.from("feature_scheduled_emails").update({ sent_at: new Date().toISOString(), sent_count: sentCount, failed_count: failedCount }).eq("id", emailId);
}

// sendAt null/omitted/in-the-past = send immediately, within this same
// request. A future sendAt just inserts the row and leaves it for the
// daily cron sweep (sendDueScheduledFeatureEmails) to pick up — same
// table either way, see migration 0116.
export async function sendFeatureEmail(
  organizationId: string,
  featureKey: FeatureEmailKey,
  subject: string,
  message: string,
  recipientUserIds: string[],
  sendAt?: string | null
): Promise<{ error: string } | { success: true; scheduled: boolean }> {
  const { supabase, user, error: authError } = await requireOrgAdmin(organizationId);
  if (authError || !user) return { error: authError ?? "Not authorized" };
  if (!subject.trim() || !message.trim()) return { error: "Subject and message are required" };
  if (recipientUserIds.length === 0) return { error: "Select at least one recipient" };

  const effectiveSendAt = sendAt ? new Date(sendAt) : new Date();
  const isFuture = effectiveSendAt.getTime() > Date.now() + 60_000; // >1min out counts as "scheduled"

  const { data: inserted, error: insertError } = await supabase
    .from("feature_scheduled_emails")
    .insert({
      organization_id: organizationId,
      feature_key: featureKey,
      subject: subject.trim(),
      message: message.trim(),
      recipient_user_ids: recipientUserIds,
      send_at: effectiveSendAt.toISOString(),
      created_by: user.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (insertError || !inserted) {
    console.error("sendFeatureEmail insert failed:", insertError);
    return { error: "Could not save this email — the database may need migration 0116 run first." };
  }

  if (!isFuture) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", recipientUserIds)
      .returns<{ id: string; full_name: string | null; email: string | null }[]>();
    const recipients = (profiles ?? [])
      .filter((p): p is { id: string; full_name: string | null; email: string } => !!p.email)
      .map((p) => ({ userId: p.id, email: p.email, name: p.full_name?.trim() || p.email }));
    await sendNow(supabase, inserted.id, subject.trim(), message.trim(), recipients);
  }

  revalidatePath(FEATURE_EMAIL_PAGE_PATH[featureKey]);
  return { success: true, scheduled: isFuture };
}

// Cron-side sweep — same secret-gated posture as every due_* reminder
// sender in lib/{knowledgeHub,performanceReviews,assessments}/
// sendReminders.ts. Called from app/api/cron/task-reminders/route.ts
// alongside those.
export async function sendDueScheduledFeatureEmails(supabase: SupabaseServerClient, secret: string): Promise<{ processed: number; sent: number; failed: number }> {
  const { data: rows, error } = await supabase.rpc("due_scheduled_feature_emails", { secret });
  if (error) {
    console.error("due_scheduled_feature_emails failed:", error);
    return { processed: 0, sent: 0, failed: 0 };
  }

  type DueRow = { id: string; subject: string; message: string; recipients: { email: string; fullName: string | null }[] };
  let sent = 0;
  let failed = 0;
  for (const row of (rows ?? []) as DueRow[]) {
    const recipients = (row.recipients ?? []).filter((r) => !!r.email);
    const results = await Promise.allSettled(
      recipients.map((r) => sendEmail(r.email, row.subject, renderFeatureEmailHtml((r.fullName ?? "").trim().split(/\s+/)[0] || "there", row.subject, row.message)))
    );
    const rowSent = results.filter((r) => r.status === "fulfilled").length;
    const rowFailed = results.length - rowSent;
    sent += rowSent;
    failed += rowFailed;
    await supabase.rpc("mark_scheduled_feature_email_sent", {
      secret,
      target_id: row.id,
      p_sent_count: rowSent,
      p_failed_count: rowFailed,
    });
  }

  return { processed: (rows ?? []).length, sent, failed };
}
