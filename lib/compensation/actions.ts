"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Every function in this file that touches compensation_records/proposals/
// approvals/changes calls an RPC (0159/0160) — never `.from(...)`. Those
// four tables have no client-facing SELECT/INSERT/UPDATE policy at all, so
// a direct query would silently return nothing; the RPCs are the only real
// access path, and each one logs the access server-side. See the build
// plan for the full reasoning.

export type CompensationRecord = {
  id: string;
  salaryBandId: string | null;
  amount: number | null; // null when the caller only has band-level ('band') visibility
  currency: string;
  payFrequency: "annual" | "monthly" | "hourly";
  effectiveFrom: string;
  effectiveTo: string | null;
  changeReason: string | null;
  createdAt: string;
  // Manually-entered reference only — never calculated, never a real
  // payroll deduction. Redacted the same as `amount` (0165).
  monthlyDeductionAmount: number | null;
  deductionNote: string | null;
};

type RawCompensationRecord = {
  id: string;
  salary_band_id: string | null;
  amount: number | null;
  currency: string;
  pay_frequency: string;
  effective_from: string;
  effective_to: string | null;
  change_reason: string | null;
  created_at: string;
  monthly_deduction_amount: number | null;
  deduction_note: string | null;
};

export async function getMyCompensation(): Promise<CompensationRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_compensation");
  if (error || !data) return [];
  return (data as RawCompensationRecord[]).map((r) => ({
    id: r.id,
    salaryBandId: r.salary_band_id,
    amount: r.amount,
    currency: r.currency,
    payFrequency: r.pay_frequency as CompensationRecord["payFrequency"],
    effectiveFrom: r.effective_from,
    effectiveTo: r.effective_to,
    changeReason: r.change_reason,
    createdAt: r.created_at,
    monthlyDeductionAmount: r.monthly_deduction_amount,
    deductionNote: r.deduction_note,
  }));
}

export async function getCompensationRecord(recordId: string): Promise<CompensationRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_compensation_record", { p_record_id: recordId });
  const rows = data as (RawCompensationRecord & { organization_id: string; employee_user_id: string })[] | null;
  if (error || !rows || rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    salaryBandId: r.salary_band_id,
    amount: r.amount,
    currency: r.currency,
    payFrequency: r.pay_frequency as CompensationRecord["payFrequency"],
    effectiveFrom: r.effective_from,
    effectiveTo: r.effective_to,
    changeReason: r.change_reason,
    createdAt: r.created_at,
    monthlyDeductionAmount: r.monthly_deduction_amount,
    deductionNote: r.deduction_note,
  };
}

export type TeamCompensationRow = {
  employeeUserId: string;
  salaryBandId: string | null;
  amount: number | null; // null under 'band' visibility
  currency: string;
  payFrequency: "annual" | "monthly" | "hourly";
  effectiveFrom: string;
  visibility: "exact" | "band";
  monthlyDeductionAmount: number | null;
  deductionNote: string | null;
};

// A manager's direct reports — redaction happens server-side per report
// (see manager_compensation_visibility in the RPC), not in this function.
type RawTeamCompensationRow = {
  employee_user_id: string;
  salary_band_id: string | null;
  amount: number | null;
  currency: string;
  pay_frequency: string;
  effective_from: string;
  visibility: string;
  monthly_deduction_amount: number | null;
  deduction_note: string | null;
};

export async function listTeamCompensation(organizationId: string): Promise<TeamCompensationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_team_compensation", { p_organization_id: organizationId });
  if (error || !data) return [];
  return (data as RawTeamCompensationRow[]).map((r) => ({
    employeeUserId: r.employee_user_id,
    salaryBandId: r.salary_band_id,
    amount: r.amount,
    currency: r.currency,
    payFrequency: r.pay_frequency as TeamCompensationRow["payFrequency"],
    effectiveFrom: r.effective_from,
    visibility: r.visibility as "exact" | "band",
    monthlyDeductionAmount: r.monthly_deduction_amount,
    deductionNote: r.deduction_note,
  }));
}

export type OrgCompensationRow = {
  employeeUserId: string;
  salaryBandId: string | null;
  amount: number;
  currency: string;
  payFrequency: "annual" | "monthly" | "hourly";
  effectiveFrom: string;
  monthlyDeductionAmount: number | null;
  deductionNote: string | null;
};

// Compensation Admin only — the RPC itself raises if the caller lacks
// has_compensation_access, surfaced here as an empty array rather than a
// thrown error (matches this codebase's "gated list returns [] on denial"
// convention, e.g. listMyRestrictedFeatures).
type RawOrgCompensationRow = {
  employee_user_id: string;
  salary_band_id: string | null;
  amount: number;
  currency: string;
  pay_frequency: string;
  effective_from: string;
  monthly_deduction_amount: number | null;
  deduction_note: string | null;
};

export async function listOrgCompensation(organizationId: string): Promise<OrgCompensationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_org_compensation", { p_organization_id: organizationId });
  if (error || !data) return [];
  return (data as RawOrgCompensationRow[]).map((r) => ({
    employeeUserId: r.employee_user_id,
    salaryBandId: r.salary_band_id,
    amount: r.amount,
    currency: r.currency,
    payFrequency: r.pay_frequency as OrgCompensationRow["payFrequency"],
    effectiveFrom: r.effective_from,
    monthlyDeductionAmount: r.monthly_deduction_amount,
    deductionNote: r.deduction_note,
  }));
}

export async function exportCompensationReport(organizationId: string): Promise<OrgCompensationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("export_compensation_report", { p_organization_id: organizationId });
  if (error || !data) return [];
  return (data as RawOrgCompensationRow[]).map((r) => ({
    employeeUserId: r.employee_user_id,
    salaryBandId: r.salary_band_id,
    amount: r.amount,
    currency: r.currency,
    payFrequency: r.pay_frequency as OrgCompensationRow["payFrequency"],
    effectiveFrom: r.effective_from,
    monthlyDeductionAmount: r.monthly_deduction_amount,
    deductionNote: r.deduction_note,
  }));
}

export type CompensationProposal = {
  id: string;
  employeeUserId: string;
  proposedBy: string;
  proposedAmount: number;
  proposedCurrency: string;
  proposedSalaryBandId: string | null;
  proposedEffectiveDate: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  proposedMonthlyDeductionAmount: number | null;
  proposedDeductionNote: string | null;
};

// Compensation Admins see the full org queue; anyone else sees only the
// proposals they personally submitted — same distinction the RPC itself
// enforces server-side (list_compensation_proposals, migration 0159).
type RawCompensationProposal = {
  id: string;
  employee_user_id: string;
  proposed_by: string;
  proposed_amount: number;
  proposed_currency: string;
  proposed_salary_band_id: string | null;
  proposed_effective_date: string;
  reason: string | null;
  status: string;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
  proposed_monthly_deduction_amount: number | null;
  proposed_deduction_note: string | null;
};

export async function listCompensationProposals(organizationId: string): Promise<CompensationProposal[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_compensation_proposals", { p_organization_id: organizationId });
  if (error || !data) return [];
  return (data as RawCompensationProposal[]).map((r) => ({
    id: r.id,
    employeeUserId: r.employee_user_id,
    proposedBy: r.proposed_by,
    proposedAmount: r.proposed_amount,
    proposedCurrency: r.proposed_currency,
    proposedSalaryBandId: r.proposed_salary_band_id,
    proposedEffectiveDate: r.proposed_effective_date,
    reason: r.reason,
    status: r.status as CompensationProposal["status"],
    createdAt: r.created_at,
    decidedAt: r.decided_at,
    decidedBy: r.decided_by,
    proposedMonthlyDeductionAmount: r.proposed_monthly_deduction_amount,
    proposedDeductionNote: r.proposed_deduction_note,
  }));
}

export async function proposeCompensationChange(input: {
  organizationId: string;
  employeeUserId: string;
  proposedAmount: number;
  proposedCurrency: string;
  proposedSalaryBandId: string | null;
  proposedEffectiveDate: string; // ISO date
  reason: string | null;
  proposedMonthlyDeductionAmount?: number | null;
  proposedDeductionNote?: string | null;
}): Promise<{ error: string } | { success: true; proposalId: string }> {
  if (input.proposedAmount < 0) return { error: "Amount must be non-negative" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("propose_compensation_change", {
    p_organization_id: input.organizationId,
    p_employee_user_id: input.employeeUserId,
    p_proposed_amount: input.proposedAmount,
    p_proposed_currency: input.proposedCurrency,
    p_proposed_salary_band_id: input.proposedSalaryBandId,
    p_proposed_effective_date: input.proposedEffectiveDate,
    p_reason: input.reason,
    p_proposed_monthly_deduction_amount: input.proposedMonthlyDeductionAmount ?? null,
    p_proposed_deduction_note: input.proposedDeductionNote ?? null,
  });
  if (error || !data) {
    console.error("proposeCompensationChange failed:", error);
    return { error: "Could not submit proposal — the database may need migration 0165 run first." };
  }

  revalidatePath("/dashboard/my-team");
  revalidatePath("/dashboard/company/compensation");
  return { success: true, proposalId: data as string };
}

export async function decideCompensationProposal(
  proposalId: string,
  decision: "approved" | "rejected",
  comment: string | null
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_compensation_proposal", {
    p_proposal_id: proposalId,
    p_decision: decision,
    p_comment: comment,
  });
  if (error) {
    console.error("decideCompensationProposal failed:", error);
    return {
      error: error.message?.includes("already been decided")
        ? "This proposal has already been decided"
        : error.message?.includes("cannot decide your own")
          ? error.message
          : "Could not record this decision",
    };
  }

  revalidatePath("/dashboard/company/compensation");
  return { success: true };
}

// Lets the original proposer (or a Compensation Admin) cancel their own
// still-pending proposal — migration 0160's withdraw_compensation_proposal.
export async function withdrawCompensationProposal(proposalId: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_compensation_proposal", { p_proposal_id: proposalId });
  if (error) {
    console.error("withdrawCompensationProposal failed:", error);
    return { error: error.message?.includes("already been decided") ? "This proposal has already been decided" : "Could not withdraw this proposal — the database may need migration 0160 run first." };
  }

  revalidatePath("/dashboard/my-team");
  revalidatePath("/dashboard/company/compensation");
  return { success: true };
}

// ============================================================
// Salary bands — normal direct RLS (migration 0154), same pattern as
// lib/organizations/competencies.ts.
// ============================================================

export type SalaryBand = {
  id: string;
  bandKey: string;
  displayName: string;
  currency: string;
  minAmount: number;
  midAmount: number | null;
  maxAmount: number;
  // Reference-only default a manager/admin can eyeball when proposing a
  // change for someone in this band — never auto-applied (0165).
  defaultMonthlyDeductionAmount: number | null;
  defaultDeductionNote: string | null;
};

export async function listSalaryBands(organizationId: string): Promise<SalaryBand[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("salary_bands")
    .select("id, band_key, display_name, currency, min_amount, mid_amount, max_amount, default_monthly_deduction_amount, default_deduction_note")
    .eq("organization_id", organizationId)
    .order("min_amount", { ascending: true })
    .returns<
      {
        id: string;
        band_key: string;
        display_name: string;
        currency: string;
        min_amount: number;
        mid_amount: number | null;
        max_amount: number;
        default_monthly_deduction_amount: number | null;
        default_deduction_note: string | null;
      }[]
    >();
  return (data ?? []).map((b) => ({
    id: b.id,
    bandKey: b.band_key,
    displayName: b.display_name,
    currency: b.currency,
    minAmount: b.min_amount,
    midAmount: b.mid_amount,
    maxAmount: b.max_amount,
    defaultMonthlyDeductionAmount: b.default_monthly_deduction_amount,
    defaultDeductionNote: b.default_deduction_note,
  }));
}

export async function createSalaryBand(
  organizationId: string,
  fields: {
    bandKey: string;
    displayName: string;
    currency: string;
    minAmount: number;
    midAmount: number | null;
    maxAmount: number;
    defaultMonthlyDeductionAmount?: number | null;
    defaultDeductionNote?: string | null;
  }
): Promise<{ error: string } | { success: true; id: string }> {
  const trimmedKey = fields.bandKey.trim();
  const trimmedName = fields.displayName.trim();
  if (!trimmedKey || !trimmedName) return { error: "Band key and name are required" };
  if (fields.minAmount > fields.maxAmount) return { error: "Minimum cannot exceed maximum" };
  if (fields.midAmount !== null && (fields.midAmount < fields.minAmount || fields.midAmount > fields.maxAmount)) {
    return { error: "Midpoint must fall between minimum and maximum" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("salary_bands")
    .insert({
      organization_id: organizationId,
      band_key: trimmedKey,
      display_name: trimmedName,
      currency: fields.currency,
      min_amount: fields.minAmount,
      mid_amount: fields.midAmount,
      max_amount: fields.maxAmount,
      default_monthly_deduction_amount: fields.defaultMonthlyDeductionAmount ?? null,
      default_deduction_note: fields.defaultDeductionNote ?? null,
      created_by: user.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) {
    if (error?.code === "23505") return { error: "A band with this key already exists" };
    console.error("createSalaryBand failed:", error);
    return { error: "Could not create salary band — the database may need migration 0154 run first." };
  }

  revalidatePath("/dashboard/company/compensation");
  return { success: true, id: data.id };
}

export async function deleteSalaryBand(id: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const { error } = await supabase.from("salary_bands").delete().eq("id", id);
  if (error) {
    console.error("deleteSalaryBand failed:", error);
    return { error: "Could not delete salary band" };
  }
  revalidatePath("/dashboard/company/compensation");
  return { success: true };
}

// ============================================================
// Terminology overrides — normal direct RLS (migration 0154), mirrors
// lib/organizations/competencies.ts exactly.
// ============================================================

export async function listCompensationTerminology(organizationId: string): Promise<Map<string, string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("compensation_terminology")
    .select("field_key, display_label")
    .eq("organization_id", organizationId)
    .returns<{ field_key: string; display_label: string }[]>();
  return new Map((data ?? []).map((r) => [r.field_key, r.display_label]));
}

export async function setCompensationTerminology(organizationId: string, fieldKey: string, displayLabel: string): Promise<{ error: string } | { success: true }> {
  const trimmed = displayLabel.trim();
  if (!trimmed) return { error: "Label is required" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("compensation_terminology")
    .upsert({ organization_id: organizationId, field_key: fieldKey, display_label: trimmed }, { onConflict: "organization_id,field_key" });
  if (error) {
    console.error("setCompensationTerminology failed:", error);
    return { error: "Could not save label — the database may need migration 0154 run first." };
  }

  revalidatePath("/dashboard/company/compensation");
  revalidatePath("/dashboard/company/permissions");
  return { success: true };
}

// ============================================================
// Manager visibility setting — organizations.compensation_manager_
// visibility (migration 0154), default 'none'. Direct RLS: writable via
// the existing "Org admins can update their own organization" policy
// (0033, is_org_admin) — deliberately NOT owner-restricted like the
// Compensation Admin grant itself; this is an org-wide HR policy setting,
// the same trust level as any other company profile field. Found missing
// during a full audit: the column and its read-side logic
// (manager_compensation_visibility()) existed since 0154, but nothing in
// the app ever let an admin change it off the 'none' default — meaning no
// manager could ever see a report's compensation through any path.
// ============================================================

export type CompensationManagerVisibility = "exact" | "band" | "none";

export async function getCompensationManagerVisibility(organizationId: string): Promise<CompensationManagerVisibility> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("compensation_manager_visibility")
    .eq("id", organizationId)
    .maybeSingle<{ compensation_manager_visibility: string | null }>();
  const value = data?.compensation_manager_visibility;
  return value === "exact" || value === "band" ? value : "none";
}

export async function setCompensationManagerVisibility(
  organizationId: string,
  visibility: CompensationManagerVisibility
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ compensation_manager_visibility: visibility })
    .eq("id", organizationId);
  if (error) {
    console.error("setCompensationManagerVisibility failed:", error);
    return { error: "Could not save this setting — the database may need migration 0154 run first." };
  }

  revalidatePath("/dashboard/company/compensation");
  return { success: true };
}
