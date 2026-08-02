"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { EXIT_INTERVIEW_QUESTIONS } from "./questions";
import type { ExitInterview, ExitInterviewQA, SeparationType } from "./types";

export async function listExitInterviews(): Promise<ExitInterview[]> {
  const supabase = await createClient();
  const company = await buildCompanyData();
  if (!company.isOrgAdmin || !company.organizationId) return [];

  const { data } = await supabase
    .from("exit_interviews")
    .select("*")
    .eq("organization_id", company.organizationId)
    .order("created_at", { ascending: false })
    .returns<ExitInterview[]>();
  return data ?? [];
}

export async function createExitInterview(fields: {
  employeeName: string;
  department?: string;
  title?: string;
  managerName?: string;
  lastDay?: string;
  separationType: SeparationType;
  answers: string[]; // parallel to EXIT_INTERVIEW_QUESTIONS
  additionalNotes?: string;
  employeeUserId?: string | null;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const company = await buildCompanyData();
  if (!company.isOrgAdmin || !company.organizationId) return { error: "Not authorized" };

  const name = fields.employeeName.trim();
  if (!name) return { error: "Employee name is required" };

  const responses: ExitInterviewQA[] = EXIT_INTERVIEW_QUESTIONS.map((question, i) => ({
    question,
    answer: (fields.answers[i] ?? "").trim(),
  })).filter((r) => r.answer.length > 0);
  if (responses.length === 0) return { error: "Answer at least one question" };

  const { error } = await supabase.from("exit_interviews").insert({
    organization_id: company.organizationId,
    employee_user_id: fields.employeeUserId ?? null,
    employee_name: name,
    department: fields.department?.trim() || null,
    title: fields.title?.trim() || null,
    manager_name: fields.managerName?.trim() || null,
    last_day: fields.lastDay || null,
    separation_type: fields.separationType,
    responses,
    additional_notes: fields.additionalNotes?.trim() || null,
    conducted_by: user.id,
  });
  if (error) {
    console.error("createExitInterview failed:", error);
    return { error: "Could not save — the database may need migration 0098 run first." };
  }

  revalidatePath("/dashboard/company/exit-interviews");
  return { success: true };
}

export async function deleteExitInterview(id: string) {
  const supabase = await createClient();
  const company = await buildCompanyData();
  if (!company.isOrgAdmin || !company.organizationId) return { error: "Not authorized" };

  const { error } = await supabase.from("exit_interviews").delete().eq("id", id).eq("organization_id", company.organizationId);
  if (error) return { error: "Could not delete — try again." };

  revalidatePath("/dashboard/company/exit-interviews");
  return { success: true };
}
