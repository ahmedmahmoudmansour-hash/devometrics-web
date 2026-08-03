import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";
import { renderEmail, escapeHtml, customMessageHtml } from "@/lib/email/template";
import { resolveAssignableName } from "@/lib/assessments/assignableCatalog";

type ReminderRow = {
  assignment_id: string;
  employee_user_id: string;
  email: string;
  full_name: string | null;
  assessment_slug: string;
  custom_subject: string | null;
  custom_message: string | null;
};
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Runs inside the existing daily task-reminders cron, same reasoning as
// every other reminder here (Vercel Hobby plan's 2-cron cap).
// resolveAssignableName handles both the self-report assessment catalog
// and the timed Case Study Exercise catalog — assigned_assessments'
// assessment_slug can point into either, same dual-path completion logic
// due_assessment_reminders' own WHERE clause already checked.
export async function sendDueAssessmentReminders(
  supabase: SupabaseServerClient,
  secret: string
): Promise<{ candidates: number; sent: number }> {
  const { data: rows, error } = await supabase.rpc("due_assessment_reminders", { secret });
  if (error) {
    console.error("due_assessment_reminders failed:", error);
    return { candidates: 0, sent: 0 };
  }

  let sent = 0;
  for (const row of (rows ?? []) as ReminderRow[]) {
    if (!row.email) continue;
    const firstName = row.full_name?.trim().split(" ")[0] || "there";
    const name = resolveAssignableName(row.assessment_slug);

    try {
      await sendEmail(
        row.email,
        row.custom_subject || `An assessment is still waiting on Devometrics: ${name}`,
        renderEmail({
          preheader: `${name} was assigned to you and hasn't been completed yet`,
          footerNote: "You're getting this because your organization assigned you an assessment on Devometrics.",
          bodyHtml: `
            <h2 style="color:#0A0F1E;font-size:20px;margin:0 0 16px;">Hi ${escapeHtml(firstName)},</h2>
            ${customMessageHtml(row.custom_message)}
            <p style="font-size:15px;line-height:1.7;margin:0 0 20px;">
              <strong>${escapeHtml(name)}</strong> was assigned to you and hasn't been completed yet.
            </p>
            <p style="margin:28px 0 0;">
              <a href="https://devometrics.com/dashboard/assessments" style="background:#00C9A7;color:#0A0F1E;text-decoration:none;font-weight:700;padding:10px 22px;border-radius:8px;display:inline-block;font-size:14px;">Open Assessment Center →</a>
            </p>
          `,
        })
      );
      await supabase.rpc("mark_assessment_reminder_sent", { secret, target_assignment_id: row.assignment_id });
      sent++;
    } catch (err) {
      console.error(`Assessment reminder email failed for user ${row.employee_user_id}:`, err);
    }
  }

  return { candidates: rows?.length ?? 0, sent };
}
