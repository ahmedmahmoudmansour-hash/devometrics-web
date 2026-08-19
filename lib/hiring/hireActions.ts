"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { sendInviteEmail } from "@/lib/organizations/actions";
import { moveCandidateStage } from "./candidateActions";

export type HireEmployeeFields = {
  title?: string;
  department?: string;
  country?: string;
  managerName?: string;
  managerEmail?: string;
  businessUnit?: string;
  location?: string;
};

// Converts a candidate into an org employee by reusing the existing
// organization_invites / checkAndConsumeInvite flow verbatim — not a new
// invite system. The candidate still signs up and sets their own password
// (this app has no service-role key), but their email is now
// admin-pre-authorized to join, exactly like any other invited employee,
// plus a candidate_id link that checkAndConsumeInvite() uses to seed their
// first Gap Analysis from the CV score already computed during hiring.
export async function markCandidateHired(candidateId: string, employeeFields: HireEmployeeFields = {}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const company = await buildCompanyData();
  if (!company.isOrgAdmin || !company.organizationId) return { error: "Not authorized" };

  const { data: candidate } = await supabase
    .from("hiring_candidates")
    .select("id, full_name, email, posting_id")
    .eq("id", candidateId)
    .eq("organization_id", company.organizationId)
    .maybeSingle<{ id: string; full_name: string; email: string; posting_id: string }>();
  if (!candidate) return { error: "Candidate not found" };

  const { data: posting } = await supabase
    .from("job_postings")
    .select("title")
    .eq("id", candidate.posting_id)
    .maybeSingle<{ title: string }>();

  // Same friendly, early seat-limit check as inviteEmployee() — the real
  // enforcement is the RLS insert policy on organization_members
  // (org_seat_limit_ok, migration 0079), which still blocks the join even
  // if this check is somehow bypassed.
  const { data: org } = await supabase
    .from("organizations")
    .select("name, seat_limit")
    .eq("id", company.organizationId)
    .maybeSingle<{ name: string; seat_limit: number | null }>();
  if (org?.seat_limit !== null && org?.seat_limit !== undefined) {
    const { count } = await supabase
      .from("organization_members")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", company.organizationId);
    if ((count ?? 0) >= org.seat_limit) {
      return { error: `This workspace is at its seat limit (${org.seat_limit}) — contact Devometrics to add more seats.` };
    }
  }

  const { error: inviteError } = await supabase.from("organization_invites").insert({
    organization_id: company.organizationId,
    email: candidate.email,
    invited_by: user.id,
    candidate_id: candidate.id,
    // A candidate hired through this pipeline is unambiguously a genuine
    // new hire (migration 0129) — unlike a direct invite, which defaults
    // false and requires the admin to opt in explicitly.
    is_new_hire: true,
    title: (employeeFields.title ?? posting?.title ?? "").trim().slice(0, 120) || null,
    department: employeeFields.department?.trim().slice(0, 120) || null,
    country: employeeFields.country?.trim().slice(0, 120) || null,
    manager_name: employeeFields.managerName?.trim().slice(0, 120) || null,
    manager_email: employeeFields.managerEmail?.trim().slice(0, 200) || null,
    business_unit: employeeFields.businessUnit?.trim().slice(0, 120) || null,
    location: employeeFields.location?.trim().slice(0, 120) || null,
  });
  if (inviteError) {
    console.error("markCandidateHired invite failed:", inviteError);
    return { error: "Could not send an invite — they may already be invited to this workspace." };
  }

  if (org?.name) await sendInviteEmail(candidate.email, org.name, company.organizationId);

  await moveCandidateStage(candidateId, "hired");

  revalidatePath("/dashboard/company");
  revalidatePath(`/dashboard/company/hiring/${candidate.posting_id}`);
  return { success: true };
}
