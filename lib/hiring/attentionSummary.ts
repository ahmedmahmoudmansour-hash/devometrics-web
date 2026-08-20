import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";
import { renderEmail, customMessageHtml } from "@/lib/email/template";
import { getEmailMessageOverride } from "@/lib/organizations/emailMessages";

export type HiringAttentionItem = {
  category: "stale_candidate" | "dead_posting";
  candidateId: string | null;
  candidateName: string | null;
  postingId: string;
  postingTitle: string;
  days: number;
};

// Thin wrapper over get_hiring_attention_summary (migration 0140) — a
// single read-only RPC combining candidates stuck 14+ days in an active
// stage and postings open 30+ days with zero candidates, so an admin
// doesn't have to open every posting individually to notice either.
export async function getHiringAttentionSummary(organizationId: string): Promise<HiringAttentionItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_hiring_attention_summary", { target_organization_id: organizationId });
  if (error) {
    console.error("get_hiring_attention_summary failed:", error);
    return [];
  }
  return (
    data as {
      category: string;
      candidate_id: string | null;
      candidate_name: string | null;
      posting_id: string;
      posting_title: string;
      days: number;
    }[]
  ).map((row) => ({
    category: row.category as HiringAttentionItem["category"],
    candidateId: row.candidate_id,
    candidateName: row.candidate_name,
    postingId: row.posting_id,
    postingTitle: row.posting_title,
    days: row.days,
  }));
}

type DigestRow = {
  organization_id: string;
  recipient_user_id: string;
  email: string;
  full_name: string | null;
  stale_candidate_count: number;
  dead_posting_count: number;
};
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Runs inside the same daily task-reminders cron as every other reminder
// (Vercel Hobby plan's 2-cron cap). Unlike the per-item reminders
// elsewhere in this app, this is a weekly per-org DIGEST to every admin
// (dedup via hiring_attention_reminder_log, one row per org) — hiring
// previously had zero entry in this cron at all.
export async function sendDueHiringAttentionDigest(supabase: SupabaseServerClient, secret: string): Promise<{ candidates: number; sent: number }> {
  const { data: rows, error } = await supabase.rpc("due_hiring_attention_digest", { secret });
  if (error) {
    console.error("due_hiring_attention_digest failed:", error);
    return { candidates: 0, sent: 0 };
  }

  let sent = 0;
  const markedOrgs = new Set<string>();
  for (const row of (rows ?? []) as DigestRow[]) {
    if (!row.email) continue;
    const firstName = row.full_name?.trim().split(" ")[0] || "there";
    const parts: string[] = [];
    if (row.stale_candidate_count > 0) parts.push(`${row.stale_candidate_count} candidate${row.stale_candidate_count === 1 ? "" : "s"} stuck 14+ days in the same stage`);
    if (row.dead_posting_count > 0) parts.push(`${row.dead_posting_count} posting${row.dead_posting_count === 1 ? "" : "s"} open 30+ days with no candidates`);
    const summary = parts.join(" and ");

    try {
      const override = await getEmailMessageOverride(row.organization_id, "hiring_attention_digest");
      await sendEmail(
        row.email,
        override.subject || "Your hiring pipeline needs a look on Devometrics",
        renderEmail({
          preheader: summary,
          footerNote: "You're getting this because your organization tracks hiring on Devometrics.",
          bodyHtml: `
            <h2 style="color:#16161a;font-size:20px;margin:0 0 16px;">Hi ${firstName},</h2>
            ${customMessageHtml(override.message)}
            <p style="font-size:15px;line-height:1.7;margin:0 0 16px;">
              ${summary}.
            </p>
            <p style="margin:20px 0 0;">
              <a href="https://devometrics.com/dashboard/company/hiring" style="background:#3f7a67;color:#16161a;text-decoration:none;font-weight:700;padding:10px 22px;border-radius:8px;display:inline-block;font-size:14px;">Open Hiring →</a>
            </p>
          `,
        })
      );
      sent++;
      // Mark-sent is per-org (dedup table's own PK), not per-recipient — no
      // harm calling it once per admin either (idempotent upsert), but
      // tracked here to skip the redundant RPC round-trip for the 2nd+
      // admin at the same org within one run.
      if (!markedOrgs.has(row.organization_id)) {
        await supabase.rpc("mark_hiring_attention_digest_sent", { secret, target_organization_id: row.organization_id });
        markedOrgs.add(row.organization_id);
      }
    } catch (err) {
      console.error(`Hiring attention digest email failed for org ${row.organization_id}:`, err);
    }
  }

  return { candidates: rows?.length ?? 0, sent };
}
