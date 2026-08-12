import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";
import { renderEmail, escapeHtml, customMessageHtml } from "@/lib/email/template";

type ReminderRow = {
  assignment_id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  content_title: string;
  due_date: string;
  overdue: boolean;
  custom_subject: string | null;
  custom_message: string | null;
};
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Runs inside the existing daily task-reminders cron (see
// app/api/cron/task-reminders/route.ts) rather than getting its own Vercel
// Cron entry — same reasoning as sendDueCertificationReminders (Hobby
// plan's 2-cron-job cap). due_knowledge_hub_reminders' own dedup (nothing
// sent in the last 3 days per assignment) keeps this from re-emailing
// someone about the same document every single day even though the check
// runs daily.
export async function sendDueKnowledgeHubReminders(
  supabase: SupabaseServerClient,
  secret: string
): Promise<{ candidates: number; sent: number }> {
  const { data: rows, error } = await supabase.rpc("due_knowledge_hub_reminders", { secret });
  if (error) {
    console.error("due_knowledge_hub_reminders failed:", error);
    return { candidates: 0, sent: 0 };
  }

  let sent = 0;
  for (const row of (rows ?? []) as ReminderRow[]) {
    if (!row.email) continue;
    const firstName = row.full_name?.trim().split(" ")[0] || "there";

    try {
      await sendEmail(
        row.email,
        row.custom_subject ||
          (row.overdue
            ? `Training overdue on Devometrics: ${row.content_title}`
            : `Training due soon on Devometrics: ${row.content_title}`),
        renderEmail({
          preheader: `${row.content_title} — ${row.overdue ? "overdue" : `due ${row.due_date}`}`,
          footerNote: "You're getting this because your organization assigned you training on Devometrics.",
          bodyHtml: `
            <h2 style="color:#16161a;font-size:20px;margin:0 0 16px;">Hi ${escapeHtml(firstName)},</h2>
            ${customMessageHtml(row.custom_message)}
            ${
              row.overdue
                ? `<h3 style="color:#c2410c;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px;">Overdue</h3>
                   <p style="font-size:15px;line-height:1.7;margin:0 0 20px;">
                     ${escapeHtml(row.content_title)} <span style="color:#8892a4;font-size:13px;">· was due ${escapeHtml(row.due_date)}</span>
                   </p>`
                : `<h3 style="color:#097066;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px;">Due soon</h3>
                   <p style="font-size:15px;line-height:1.7;margin:0 0 20px;">
                     ${escapeHtml(row.content_title)} <span style="color:#8892a4;font-size:13px;">· due ${escapeHtml(row.due_date)}</span>
                   </p>`
            }
            <p style="margin:28px 0 0;">
              <a href="https://devometrics.com/dashboard/knowledge-hub" style="background:#3f7a67;color:#16161a;text-decoration:none;font-weight:700;padding:10px 22px;border-radius:8px;display:inline-block;font-size:14px;">Open Knowledge Hub →</a>
            </p>
          `,
        })
      );
      // Only mark as sent after a successful send — same reasoning as
      // task/certification reminders: a failed send just means this
      // assignment is picked up again on the next run, not skipped forever.
      await supabase.rpc("mark_knowledge_hub_reminder_sent", { secret, target_assignment_id: row.assignment_id });
      sent++;
    } catch (err) {
      console.error(`Knowledge Hub reminder email failed for user ${row.user_id}:`, err);
    }
  }

  return { candidates: rows?.length ?? 0, sent };
}
