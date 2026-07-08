"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { extractCareerProfile, type JobHistoryEntry, type QualificationEntry } from "./extractCareerProfile";

export async function importCareerProfileFromCV() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: latestAnalysis } = await supabase
    .from("gap_analyses")
    .select("cv_text")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ cv_text: string }>();

  if (!latestAnalysis?.cv_text) {
    return { error: "Run a Gap Analysis with your CV first — there's nothing to import from yet." };
  }

  let extracted;
  try {
    extracted = await extractCareerProfile(latestAnalysis.cv_text);
  } catch {
    return { error: "Could not read your CV right now — try again." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      job_history: extracted.jobHistory,
      skills: extracted.skills,
      qualifications: extracted.qualifications,
    })
    .eq("id", user.id);
  if (error) return { error: "Could not save your career profile — try again." };

  revalidatePath("/dashboard/profile");
  return { success: true, extracted };
}

export async function updateCareerProfile(fields: {
  jobHistory: JobHistoryEntry[];
  skills: string[];
  qualifications: QualificationEntry[];
  careerAspirations: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({
      job_history: fields.jobHistory,
      skills: fields.skills,
      qualifications: fields.qualifications,
      career_aspirations: fields.careerAspirations.trim() || null,
    })
    .eq("id", user.id);
  if (error) return { error: "Could not save — try again." };

  revalidatePath("/dashboard/profile");
  return { success: true };
}
