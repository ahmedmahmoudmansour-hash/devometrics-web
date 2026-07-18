"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { JobApplication, JobApplicationStage } from "./types";

export async function listJobApplications(): Promise<{ applications: JobApplication[]; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { applications: [] };

  const { data, error } = await supabase
    .from("job_applications")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .returns<JobApplication[]>();

  if (error) return { applications: [], error: "not_migrated" };
  return { applications: data ?? [] };
}

export async function createJobApplication(fields: {
  company: string;
  roleTitle: string;
  jobUrl?: string | null;
  location?: string | null;
  source?: string | null;
  stage?: JobApplicationStage;
  appliedDate?: string | null;
  salaryRange?: string | null;
  notes?: string | null;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const company = fields.company.trim();
  const roleTitle = fields.roleTitle.trim();
  if (!company || !roleTitle) return { error: "Company and role are required" };

  const { error } = await supabase.from("job_applications").insert({
    user_id: user.id,
    company,
    role_title: roleTitle,
    job_url: fields.jobUrl?.trim() || null,
    location: fields.location?.trim() || null,
    source: fields.source?.trim() || null,
    stage: fields.stage ?? "saved",
    applied_date: fields.appliedDate?.trim() || null,
    salary_range: fields.salaryRange?.trim() || null,
    notes: fields.notes?.trim() || null,
  });
  if (error) {
    console.error("createJobApplication insert failed:", error);
    return { error: "Could not save — try again." };
  }

  revalidatePath("/dashboard/job-applications");
  return { success: true };
}

export async function updateJobApplication(
  id: string,
  fields: Partial<{
    company: string;
    roleTitle: string;
    jobUrl: string | null;
    location: string | null;
    source: string | null;
    stage: JobApplicationStage;
    appliedDate: string | null;
    nextAction: string | null;
    nextActionDate: string | null;
    salaryRange: string | null;
    notes: string | null;
  }>
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const patch: Record<string, string | null> = { updated_at: new Date().toISOString() };
  if (fields.company !== undefined) patch.company = fields.company.trim();
  if (fields.roleTitle !== undefined) patch.role_title = fields.roleTitle.trim();
  if (fields.jobUrl !== undefined) patch.job_url = fields.jobUrl?.trim() || null;
  if (fields.location !== undefined) patch.location = fields.location?.trim() || null;
  if (fields.source !== undefined) patch.source = fields.source?.trim() || null;
  if (fields.stage !== undefined) patch.stage = fields.stage;
  if (fields.appliedDate !== undefined) patch.applied_date = fields.appliedDate?.trim() || null;
  if (fields.nextAction !== undefined) patch.next_action = fields.nextAction?.trim() || null;
  if (fields.nextActionDate !== undefined) patch.next_action_date = fields.nextActionDate?.trim() || null;
  if (fields.salaryRange !== undefined) patch.salary_range = fields.salaryRange?.trim() || null;
  if (fields.notes !== undefined) patch.notes = fields.notes?.trim() || null;

  const { error } = await supabase.from("job_applications").update(patch).eq("id", id).eq("user_id", user.id);
  if (error) return { error: "Could not update — try again." };

  revalidatePath("/dashboard/job-applications");
  return { success: true };
}

export async function deleteJobApplication(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("job_applications").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: "Could not delete — try again." };

  revalidatePath("/dashboard/job-applications");
  return { success: true };
}
