"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Called by the SCORM runtime adapter (components/dashboard/
// KnowledgeHubScormRuntime.tsx) on LMSFinish (or, best-effort, on the
// content window unloading without ever calling it). Thin wrapper around
// submit_scorm_completion (migration 0149) — same "RPC is the only write
// path" posture as submitKnowledgeHubExam in lib/knowledgeHub/actions.ts.
export async function submitScormCompletion(
  contentId: string,
  input: { scoreRaw: number | null; lessonStatus: string; cmiData: Record<string, string> }
): Promise<{ error: string } | { success: true; scorePercent: number | null; passed: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_scorm_completion", {
    p_content_id: contentId,
    p_score_raw: input.scoreRaw,
    p_lesson_status: input.lessonStatus,
    p_cmi_data: input.cmiData,
  });
  const rows = data as { score_percent: number | null; passed: boolean }[] | null;
  if (error || !rows?.[0]) {
    return { error: error?.message ?? "Could not record this completion — the database may need migration 0149 run first." };
  }

  revalidatePath("/dashboard/knowledge-hub");
  revalidatePath(`/dashboard/knowledge-hub/${contentId}`);
  return { success: true, scorePercent: rows[0].score_percent, passed: rows[0].passed };
}
