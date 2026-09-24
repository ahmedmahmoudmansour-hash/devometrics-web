"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";
import { renderEmail, escapeHtml } from "@/lib/email/template";

// hr_letter_requests uses normal direct-table RLS for read/insert (same
// lighter-weight pattern as leave_requests, 0166's header) — only deciding
// (issue/reject) goes through an RPC, since that must not be a raw UPDATE
// a self-interested admin could bypass. See 0169.

export type HrLetterRequest = {
  id: string;
  employeeUserId: string;
  requestedBy: string;
  includeSalary: boolean;
  purpose: string | null;
  status: "pending" | "issued" | "rejected";
  requestedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionNote: string | null;
};

type RawHrLetterRequest = {
  id: string;
  employee_user_id: string;
  requested_by: string;
  include_salary: boolean;
  purpose: string | null;
  status: string;
  requested_at: string;
  decided_at: string | null;
  decided_by: string | null;
  decision_note: string | null;
};

const HR_LETTER_COLUMNS =
  "id, employee_user_id, requested_by, include_salary, purpose, status, requested_at, decided_at, decided_by, decision_note";

function mapHrLetterRequest(r: RawHrLetterRequest): HrLetterRequest {
  return {
    id: r.id,
    employeeUserId: r.employee_user_id,
    requestedBy: r.requested_by,
    includeSalary: r.include_salary,
    purpose: r.purpose,
    status: r.status as HrLetterRequest["status"],
    requestedAt: r.requested_at,
    decidedAt: r.decided_at,
    decidedBy: r.decided_by,
    decisionNote: r.decision_note,
  };
}

export async function listMyHrLetterRequests(): Promise<HrLetterRequest[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("hr_letter_requests")
    .select(HR_LETTER_COLUMNS)
    .eq("employee_user_id", user.id)
    .order("requested_at", { ascending: false })
    .returns<RawHrLetterRequest[]>();
  return (data ?? []).map(mapHrLetterRequest);
}

// Org admin only — RLS restricts this regardless of what's asked for.
export async function listOrgHrLetterRequests(organizationId: string): Promise<HrLetterRequest[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hr_letter_requests")
    .select(HR_LETTER_COLUMNS)
    .eq("organization_id", organizationId)
    .order("requested_at", { ascending: false })
    .returns<RawHrLetterRequest[]>();
  return (data ?? []).map(mapHrLetterRequest);
}

// Best-effort HR notification — never lets an email-sending failure (e.g.
// RESEND_API_KEY not configured in this environment yet) block the actual
// request from being created, same "email failures must not block the
// core action" posture as sendDueManagerActionReminders.
async function notifyOrgAdminsOfLetterRequest(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  employeeName: string,
  includeSalary: boolean,
  purpose: string | null
) {
  try {
    const { data, error } = await supabase.rpc("get_org_admin_emails", { check_org_id: organizationId });
    if (error || !data) return;
    const admins = data as { email: string; full_name: string | null }[];
    if (!admins.length) return;

    const salaryLine = includeSalary ? "including their salary figure" : "without salary details";
    const purposeLine = purpose?.trim() ? `<p style="font-size:14px;color:var(--text-muted);margin:0 0 16px;">Stated purpose: ${escapeHtml(purpose.trim())}</p>` : "";

    await Promise.all(
      admins.map((admin) =>
        sendEmail(
          admin.email,
          `New HR letter request from ${employeeName}`,
          renderEmail({
            preheader: `${employeeName} requested an HR letter (${salaryLine})`,
            footerNote: "You're getting this because your organization tracks HR letter requests on Devometrics.",
            bodyHtml: `
              <h2 style="color:#16161a;font-size:20px;margin:0 0 16px;">Hi ${escapeHtml(admin.full_name?.trim().split(" ")[0] || "there")},</h2>
              <p style="font-size:15px;line-height:1.7;margin:0 0 8px;"><strong>${escapeHtml(employeeName)}</strong> requested an HR letter, ${salaryLine}.</p>
              ${purposeLine}
              <p style="margin:20px 0 0;">
                <a href="https://devometrics.com/dashboard/company/leave" style="background:#3f7a67;color:#16161a;text-decoration:none;font-weight:700;padding:10px 22px;border-radius:8px;display:inline-block;font-size:14px;">Review request →</a>
              </p>
            `,
          })
        ).catch((err) => console.error(`HR letter notification failed for ${admin.email}:`, err))
      )
    );
  } catch (err) {
    console.error("notifyOrgAdminsOfLetterRequest failed:", err);
  }
}

export async function requestHrLetter(input: {
  organizationId: string;
  includeSalary: boolean;
  purpose: string | null;
}): Promise<{ error: string } | { success: true; id: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("hr_letter_requests")
    .insert({
      organization_id: input.organizationId,
      employee_user_id: user.id,
      requested_by: user.id,
      include_salary: input.includeSalary,
      purpose: input.purpose,
      status: "pending",
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) {
    console.error("requestHrLetter failed:", error);
    return { error: "Could not submit request — the database may need migration 0169 run first." };
  }

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle<{ full_name: string | null }>();
  await notifyOrgAdminsOfLetterRequest(supabase, input.organizationId, profile?.full_name?.trim() || "An employee", input.includeSalary, input.purpose);

  revalidatePath("/dashboard/leave");
  revalidatePath("/dashboard/company/leave");
  return { success: true, id: data.id };
}

// Org-admin only (enforced in the RPC), blocked on self-decision unless no
// other admin exists (0169's self-approval guard, mirroring 0168).
export async function decideHrLetterRequest(
  requestId: string,
  decision: "issued" | "rejected",
  note: string | null
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_hr_letter_request", {
    p_request_id: requestId,
    p_decision: decision,
    p_note: note,
  });
  if (error) {
    console.error("decideHrLetterRequest failed:", error);
    return {
      error: error.message?.includes("already been decided")
        ? "This request has already been decided"
        : error.message?.includes("cannot decide your own")
          ? error.message
          : "Could not record this decision — the database may need migration 0169 run first.",
    };
  }

  revalidatePath("/dashboard/company/leave");
  revalidatePath("/dashboard/leave");
  return { success: true };
}
