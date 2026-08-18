import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";
import { renderEmail, escapeHtml, customMessageHtml } from "@/lib/email/template";

type ManagerReminderRow = {
  review_id: string;
  recipient_user_id: string;
  email: string;
  full_name: string | null;
  employee_name: string | null;
  cycle_name: string;
  kind: "accept_probation" | "submit_assessment";
  is_fallback_admin: boolean;
  custom_subject: string | null;
  custom_message: string | null;
};
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Runs inside the same daily task-reminders cron as every other reminder
// (Vercel Hobby plan's 2-cron cap). Covers a gap a 2026-08-18 process-delay
// audit found: submit_manager_assessment/accept_probation_review can each
// block a review indefinitely, and until this, only the employee's self-
// assessment ever got a reminder — never the manager. due_manager_action_
// reminders resolves the recipient as the employee's current manager
// (organization_members.manager_user_id) or, if that's unset (e.g. the
// manager left the org), an org admin instead — is_fallback_admin lets the
// copy below say so plainly rather than addressing an admin as if they
// were the direct manager.
export async function sendDueManagerActionReminders(
  supabase: SupabaseServerClient,
  secret: string
): Promise<{ candidates: number; sent: number }> {
  const { data: rows, error } = await supabase.rpc("due_manager_action_reminders", { secret });
  if (error) {
    console.error("due_manager_action_reminders failed:", error);
    return { candidates: 0, sent: 0 };
  }

  let sent = 0;
  for (const row of (rows ?? []) as ManagerReminderRow[]) {
    if (!row.email) continue;
    const firstName = row.full_name?.trim().split(" ")[0] || "there";
    const employeeName = row.employee_name?.trim() || "your team member";
    const isAccept = row.kind === "accept_probation";

    const defaultSubject = isAccept
      ? `${employeeName}'s probation review is waiting for you on Devometrics`
      : `${employeeName}'s Manager's Perspective is still open on Devometrics`;
    const bodyLine = isAccept
      ? `<strong>${escapeHtml(employeeName)}</strong>'s probation review (${escapeHtml(row.cycle_name)}) is still waiting for you to review and accept it.`
      : `<strong>${escapeHtml(employeeName)}</strong>'s ${escapeHtml(row.cycle_name)} is open, and your Manager's Perspective hasn't been submitted yet.`;
    const fallbackNote = row.is_fallback_admin
      ? `<p style="font-size:12.5px;color:#8892a4;margin:0 0 20px;">You're getting this as an org admin — ${escapeHtml(employeeName)} currently has no manager assigned.</p>`
      : "";

    try {
      await sendEmail(
        row.email,
        row.custom_subject || defaultSubject,
        renderEmail({
          preheader: isAccept
            ? `${employeeName}'s probation review needs your acceptance`
            : `${employeeName}'s Manager's Perspective hasn't been submitted yet`,
          footerNote: "You're getting this because your organization tracks performance reviews on Devometrics.",
          bodyHtml: `
            <h2 style="color:#16161a;font-size:20px;margin:0 0 16px;">Hi ${escapeHtml(firstName)},</h2>
            ${customMessageHtml(row.custom_message)}
            <p style="font-size:15px;line-height:1.7;margin:0 0 8px;">${bodyLine}</p>
            ${fallbackNote}
            <p style="margin:20px 0 0;">
              <a href="https://devometrics.com/dashboard/my-team" style="background:#3f7a67;color:#16161a;text-decoration:none;font-weight:700;padding:10px 22px;border-radius:8px;display:inline-block;font-size:14px;">Open My Team →</a>
            </p>
          `,
        })
      );
      // Only mark as sent after a successful send — same "retry on the next
      // run rather than skip forever" reasoning as every other reminder.
      await supabase.rpc("mark_manager_action_reminder_sent", { secret, target_review_id: row.review_id });
      sent++;
    } catch (err) {
      console.error(`Manager action reminder email failed for review ${row.review_id}:`, err);
    }
  }

  return { candidates: rows?.length ?? 0, sent };
}
