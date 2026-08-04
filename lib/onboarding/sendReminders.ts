import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";
import { renderEmail, escapeHtml, customMessageHtml } from "@/lib/email/template";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type StepReminderRow = {
  step_id: string;
  employee_user_id: string;
  email: string;
  full_name: string | null;
  step_title: string;
  due_date: string;
  organization_id: string;
  custom_subject: string | null;
  custom_message: string | null;
};

type ManagerApprovalReminderRow = {
  step_id: string;
  manager_user_id: string;
  email: string;
  full_name: string | null;
  employee_name: string | null;
  step_title: string;
  organization_id: string;
  custom_subject: string | null;
  custom_message: string | null;
};

// Runs inside the existing daily task-reminders cron, same reasoning as
// every other reminder type here (Vercel Hobby plan's cron-count cap).
// Only ever reminds the EMPLOYEE about their own due, incomplete
// task/knowledge_hub onboarding step — due_onboarding_reminders' own
// scoping (step_type in ('task','knowledge_hub')) keeps manager_approval
// steps out of this one entirely.
export async function sendDueOnboardingReminders(
  supabase: SupabaseServerClient,
  secret: string
): Promise<{ candidates: number; sent: number }> {
  const { data: rows, error } = await supabase.rpc("due_onboarding_reminders", { secret });
  if (error) {
    console.error("due_onboarding_reminders failed:", error);
    return { candidates: 0, sent: 0 };
  }

  let sent = 0;
  for (const row of (rows ?? []) as StepReminderRow[]) {
    if (!row.email) continue;
    const firstName = row.full_name?.trim().split(" ")[0] || "there";

    try {
      await sendEmail(
        row.email,
        row.custom_subject || "Your onboarding checklist has an item due on Devometrics",
        renderEmail({
          preheader: `${row.step_title} — due ${row.due_date}`,
          footerNote: "You're getting this because you have an onboarding checklist in progress on Devometrics.",
          bodyHtml: `
            <h2 style="color:#0A0F1E;font-size:20px;margin:0 0 16px;">Hi ${escapeHtml(firstName)},</h2>
            ${customMessageHtml(row.custom_message)}
            <p style="font-size:15px;line-height:1.7;margin:0 0 8px;">
              <strong>${escapeHtml(row.step_title)}</strong> on your onboarding checklist is due.
            </p>
            <p style="font-size:13px;color:#8892a4;margin:0 0 24px;">Due by ${escapeHtml(row.due_date)}</p>
            <p style="margin:0;">
              <a href="https://devometrics.com/dashboard/onboarding" style="background:#00C9A7;color:#0A0F1E;text-decoration:none;font-weight:700;padding:10px 22px;border-radius:8px;display:inline-block;font-size:14px;">Open your onboarding →</a>
            </p>
          `,
        })
      );
      await supabase.rpc("mark_onboarding_reminder_sent", { secret, target_step_id: row.step_id });
      sent++;
    } catch (err) {
      console.error(`Onboarding step reminder email failed for user ${row.employee_user_id}:`, err);
    }
  }

  return { candidates: rows?.length ?? 0, sent };
}

// Reminds the MANAGER, never the employee — due_onboarding_manager_approval_
// reminders' own scoping (step_type = 'manager_approval') keeps this
// entirely separate from the employee-facing reminder above.
export async function sendDueOnboardingManagerApprovalReminders(
  supabase: SupabaseServerClient,
  secret: string
): Promise<{ candidates: number; sent: number }> {
  const { data: rows, error } = await supabase.rpc("due_onboarding_manager_approval_reminders", { secret });
  if (error) {
    console.error("due_onboarding_manager_approval_reminders failed:", error);
    return { candidates: 0, sent: 0 };
  }

  let sent = 0;
  for (const row of (rows ?? []) as ManagerApprovalReminderRow[]) {
    if (!row.email) continue;
    const managerFirstName = row.full_name?.trim().split(" ")[0] || "there";
    const employeeName = row.employee_name?.trim() || "Your report";

    try {
      await sendEmail(
        row.email,
        row.custom_subject || `${employeeName}'s onboarding step needs your approval on Devometrics`,
        renderEmail({
          preheader: `${row.step_title} is waiting on your approval`,
          footerNote: "You're getting this because one of your reports has an onboarding step waiting on your approval.",
          bodyHtml: `
            <h2 style="color:#0A0F1E;font-size:20px;margin:0 0 16px;">Hi ${escapeHtml(managerFirstName)},</h2>
            ${customMessageHtml(row.custom_message)}
            <p style="font-size:15px;line-height:1.7;margin:0 0 24px;">
              <strong>${escapeHtml(employeeName)}</strong>'s onboarding step — <strong>${escapeHtml(row.step_title)}</strong> — is waiting on your approval.
            </p>
            <p style="margin:0;">
              <a href="https://devometrics.com/dashboard/my-team" style="background:#00C9A7;color:#0A0F1E;text-decoration:none;font-weight:700;padding:10px 22px;border-radius:8px;display:inline-block;font-size:14px;">Review your team →</a>
            </p>
          `,
        })
      );
      await supabase.rpc("mark_onboarding_manager_approval_reminder_sent", { secret, target_step_id: row.step_id });
      sent++;
    } catch (err) {
      console.error(`Onboarding manager-approval reminder email failed for manager ${row.manager_user_id}:`, err);
    }
  }

  return { candidates: rows?.length ?? 0, sent };
}
