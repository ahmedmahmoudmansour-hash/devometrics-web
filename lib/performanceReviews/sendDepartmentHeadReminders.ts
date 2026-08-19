import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";
import { renderEmail, escapeHtml, customMessageHtml } from "@/lib/email/template";

type ReminderRow = {
  review_id: string;
  recipient_user_id: string;
  email: string;
  full_name: string | null;
  employee_name: string | null;
  cycle_name: string;
  custom_subject: string | null;
  custom_message: string | null;
};
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Runs inside the same daily task-reminders cron as every other reminder
// (Vercel Hobby plan's 2-cron cap). Covers the one manager-facing step
// migration 0126 left out: the optional Department Head Review (level 2+
// upline signoff). due_department_head_review_reminders walks the org's
// configured escalation chain itself — every row returned here is already
// a genuinely eligible, not-yet-signed-off upline manager, so this sender
// stays a thin loop, same shape as sendManagerReminders.ts.
export async function sendDueDepartmentHeadReviewReminders(
  supabase: SupabaseServerClient,
  secret: string
): Promise<{ candidates: number; sent: number }> {
  const { data: rows, error } = await supabase.rpc("due_department_head_review_reminders", { secret });
  if (error) {
    console.error("due_department_head_review_reminders failed:", error);
    return { candidates: 0, sent: 0 };
  }

  let sent = 0;
  for (const row of (rows ?? []) as ReminderRow[]) {
    if (!row.email) continue;
    const firstName = row.full_name?.trim().split(" ")[0] || "there";
    const employeeName = row.employee_name?.trim() || "a team member";

    try {
      await sendEmail(
        row.email,
        row.custom_subject || `${employeeName}'s Department Head Review is still open on Devometrics`,
        renderEmail({
          preheader: `${employeeName}'s ${row.cycle_name} is waiting on your Department Head Review`,
          footerNote: "You're getting this because your organization tracks performance reviews on Devometrics.",
          bodyHtml: `
            <h2 style="color:#16161a;font-size:20px;margin:0 0 16px;">Hi ${escapeHtml(firstName)},</h2>
            ${customMessageHtml(row.custom_message)}
            <p style="font-size:15px;line-height:1.7;margin:0 0 16px;">
              <strong>${escapeHtml(employeeName)}</strong>'s ${escapeHtml(row.cycle_name)} is still waiting on your optional Department Head Review.
            </p>
            <p style="margin:20px 0 0;">
              <a href="https://devometrics.com/dashboard/my-team" style="background:#3f7a67;color:#16161a;text-decoration:none;font-weight:700;padding:10px 22px;border-radius:8px;display:inline-block;font-size:14px;">Open My Team →</a>
            </p>
          `,
        })
      );
      // Only mark as sent after a successful send — same "retry on the next
      // run rather than skip forever" reasoning as every other reminder.
      await supabase.rpc("mark_department_head_review_reminder_sent", {
        secret,
        target_review_id: row.review_id,
        target_manager_user_id: row.recipient_user_id,
      });
      sent++;
    } catch (err) {
      console.error(`Department Head Review reminder email failed for review ${row.review_id}:`, err);
    }
  }

  return { candidates: rows?.length ?? 0, sent };
}
