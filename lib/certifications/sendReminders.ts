import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";
import { renderEmail, escapeHtml } from "@/lib/email/template";

type ReminderCert = { name: string; issuer: string | null; expiry_date: string; expired: boolean };
type ReminderRow = { user_id: string; email: string; full_name: string | null; certifications: ReminderCert[] };
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Runs inside the existing daily task-reminders cron (see
// app/api/cron/task-reminders/route.ts) rather than getting its own Vercel
// Cron entry — Vercel's Hobby plan caps a project at 2 cron jobs total, and
// this project already has 2 (task-reminders, purge-deletions). Folding
// certification reminders into the task-reminders run keeps this working on
// any plan tier instead of silently failing to deploy a 3rd cron job.
// due_certification_reminders' own dedup (nothing sent in the last 6 days)
// means this still only emails someone about the same cert about once a
// week even though the check now runs daily alongside tasks.
export async function sendDueCertificationReminders(
  supabase: SupabaseServerClient,
  secret: string
): Promise<{ candidates: number; sent: number }> {
  const { data: rows, error } = await supabase.rpc("due_certification_reminders", { secret });
  if (error) {
    console.error("due_certification_reminders failed:", error);
    return { candidates: 0, sent: 0 };
  }

  let sent = 0;
  for (const row of (rows ?? []) as ReminderRow[]) {
    if (!row.email) continue;
    const certs = row.certifications ?? [];
    const expired = certs.filter((c) => c.expired);
    const expiring = certs.filter((c) => !c.expired);
    const firstName = row.full_name?.trim().split(" ")[0] || "there";

    try {
      await sendEmail(
        row.email,
        expired.length > 0
          ? `${expired.length} certification${expired.length === 1 ? "" : "s"} expired on Devometrics`
          : "A certification is expiring soon on Devometrics",
        renderEmail({
          preheader: `${certs.length} credential${certs.length === 1 ? "" : "s"} need attention — ${certs
            .slice(0, 2)
            .map((c) => c.name)
            .join(", ")}`,
          footerNote: "You're getting this because you track certifications on Devometrics — manage them anytime from Certifications.",
          bodyHtml: `
            <h2 style="color:#0A0F1E;font-size:20px;margin:0 0 16px;">Hi ${escapeHtml(firstName)},</h2>
            ${
              expired.length > 0
                ? `<h3 style="color:#c2410c;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px;">Expired</h3>
                   <ul style="line-height:1.9;font-size:15px;padding-left:20px;margin:0 0 20px;">
                     ${expired.map((c) => `<li>${escapeHtml(c.name)}${c.issuer ? ` <span style="color:#8892a4;font-size:13px;">· ${escapeHtml(c.issuer)}</span>` : ""} <span style="color:#8892a4;font-size:13px;">· expired ${escapeHtml(c.expiry_date)}</span></li>`).join("")}
                   </ul>`
                : ""
            }
            ${
              expiring.length > 0
                ? `<h3 style="color:#097066;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px;">Expiring within 30 days</h3>
                   <ul style="line-height:1.9;font-size:15px;padding-left:20px;margin:0;">
                     ${expiring.map((c) => `<li>${escapeHtml(c.name)}${c.issuer ? ` <span style="color:#8892a4;font-size:13px;">· ${escapeHtml(c.issuer)}</span>` : ""} <span style="color:#8892a4;font-size:13px;">· expires ${escapeHtml(c.expiry_date)}</span></li>`).join("")}
                   </ul>`
                : ""
            }
            <p style="margin:28px 0 0;">
              <a href="https://devometrics.com/dashboard/certifications" style="background:#00C9A7;color:#0A0F1E;text-decoration:none;font-weight:700;padding:10px 22px;border-radius:8px;display:inline-block;font-size:14px;">Review your certifications →</a>
            </p>
          `,
        })
      );
      await supabase.rpc("mark_certification_reminder_sent", { secret, target_user_id: row.user_id });
      sent++;
    } catch (err) {
      console.error(`Certification reminder email failed for user ${row.user_id}:`, err);
    }
  }

  return { candidates: rows?.length ?? 0, sent };
}
