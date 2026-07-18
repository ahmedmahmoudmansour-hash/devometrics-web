import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";
import { renderEmail, escapeHtml } from "@/lib/email/template";
import { sendDueCertificationReminders } from "@/lib/certifications/sendReminders";

type ReminderTask = { title: string; date: string; overdue: boolean };
type ReminderRow = { user_id: string; email: string; full_name: string | null; tasks: ReminderTask[] };

// Triggered daily by Vercel Cron (see vercel.json). Vercel automatically
// sends "Authorization: Bearer $CRON_SECRET" on cron-triggered requests
// when an env var of that exact name is set — this check stops anyone else
// from hitting the route and burning the Resend quota, but it's NOT what
// keeps the underlying data private (see the migration comment on
// due_task_reminders for why that check has to live in the database
// function itself).
//
// Also sends due certification-expiry reminders (sendDueCertificationReminders)
// piggybacking on this same daily run rather than getting a separate Vercel
// Cron entry — see that function's own comment for why (Hobby plan's 2-cron
// cap).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc("due_task_reminders", { secret });
  if (error) {
    console.error("due_task_reminders failed:", error);
    return NextResponse.json({ error: "Failed to load reminders" }, { status: 500 });
  }

  let sent = 0;
  for (const row of (rows ?? []) as ReminderRow[]) {
    if (!row.email) continue;
    const tasks = row.tasks ?? [];
    const overdue = tasks.filter((t) => t.overdue);
    const dueToday = tasks.filter((t) => !t.overdue);
    const firstName = row.full_name?.trim().split(" ")[0] || "there";

    try {
      await sendEmail(
        row.email,
        overdue.length > 0
          ? `${tasks.length} task${tasks.length === 1 ? "" : "s"} need your attention on Devometrics`
          : "Today's tasks on Devometrics",
        renderEmail({
          preheader: `${tasks.length} task${tasks.length === 1 ? "" : "s"} due — ${tasks
            .slice(0, 2)
            .map((t) => t.title)
            .join(", ")}`,
          footerNote: "You're getting this because you have tasks tracked on Devometrics — manage them anytime from Tasks & Calendar.",
          bodyHtml: `
            <h2 style="color:#0A0F1E;font-size:20px;margin:0 0 16px;">Hi ${escapeHtml(firstName)},</h2>
            ${
              overdue.length > 0
                ? `<h3 style="color:#c2410c;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px;">Overdue</h3>
                   <ul style="line-height:1.9;font-size:15px;padding-left:20px;margin:0 0 20px;">
                     ${overdue.map((t) => `<li>${escapeHtml(t.title)} <span style="color:#8892a4;font-size:13px;">· ${escapeHtml(t.date)}</span></li>`).join("")}
                   </ul>`
                : ""
            }
            ${
              dueToday.length > 0
                ? `<h3 style="color:#097066;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px;">Due today</h3>
                   <ul style="line-height:1.9;font-size:15px;padding-left:20px;margin:0;">
                     ${dueToday.map((t) => `<li>${escapeHtml(t.title)}</li>`).join("")}
                   </ul>`
                : ""
            }
            <p style="margin:28px 0 0;">
              <a href="https://devometrics.com/dashboard/tasks" style="background:#00C9A7;color:#0A0F1E;text-decoration:none;font-weight:700;padding:10px 22px;border-radius:8px;display:inline-block;font-size:14px;">Open your tasks →</a>
            </p>
          `,
        })
      );
      // Only mark as sent after a successful send — a failed send for one
      // user shouldn't count against tomorrow's reminder for them, and a
      // failure here just means they're picked up again on the next run.
      await supabase.rpc("mark_task_reminder_sent", { secret, target_user_id: row.user_id });
      sent++;
    } catch (err) {
      console.error(`Task reminder email failed for user ${row.user_id}:`, err);
    }
  }

  const certResult = await sendDueCertificationReminders(supabase, secret);

  return NextResponse.json({
    candidates: rows?.length ?? 0,
    sent,
    certifications: certResult,
  });
}
