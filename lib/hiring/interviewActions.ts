"use server";

import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { MAX_INTERVIEW_NOTE_LENGTH } from "@/lib/limits";
import type { CandidateAssessment } from "./types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, organizationId: null };
  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) return { supabase, user: null, organizationId: null };
  return { supabase, user, organizationId: data.organizationId };
}

// Never touches employee_manager_notes — interview notes on a not-yet-hired
// candidate are an entirely separate table/code path, by design (see
// migration 0088's header comment). employee_manager_notes stays exactly
// as it is: free text on a current employee, deliberately never AI-scored.
export async function addInterviewNote(candidateId: string, note: string) {
  const { supabase, user, organizationId } = await requireAdmin();
  if (!user || !organizationId) return { error: "Not authorized" };

  const trimmed = note.trim().slice(0, MAX_INTERVIEW_NOTE_LENGTH);
  if (!trimmed) return { error: "Write a note first" };

  const { data: candidate } = await supabase
    .from("hiring_candidates")
    .select("id, posting_id")
    .eq("id", candidateId)
    .eq("organization_id", organizationId)
    .maybeSingle<{ id: string; posting_id: string }>();
  if (!candidate) return { error: "Candidate not found" };

  const { error } = await supabase.from("hiring_candidate_interview_notes").insert({
    organization_id: organizationId,
    candidate_id: candidateId,
    author_id: user.id,
    note: trimmed,
  });
  if (error) {
    console.error("addInterviewNote failed:", error);
    return { error: "Could not save the note — the database may need migration 0088 run first." };
  }

  revalidatePath(`/dashboard/company/hiring/${candidate.posting_id}/candidates/${candidateId}`);
  return { success: true };
}

export async function deleteInterviewNote(noteId: string, candidateId: string) {
  const { supabase, user, organizationId } = await requireAdmin();
  if (!user || !organizationId) return { error: "Not authorized" };

  const { data: candidate } = await supabase
    .from("hiring_candidates")
    .select("posting_id")
    .eq("id", candidateId)
    .eq("organization_id", organizationId)
    .maybeSingle<{ posting_id: string }>();
  if (!candidate) return { error: "Candidate not found" };

  await supabase.from("hiring_candidate_interview_notes").delete().eq("id", noteId).eq("candidate_id", candidateId);
  revalidatePath(`/dashboard/company/hiring/${candidate.posting_id}/candidates/${candidateId}`);
  return { success: true };
}

const RECORD_TOOL = {
  name: "record_candidate_assessment",
  description: "Score a hiring candidate's interview performance from a manager's notes and produce a structured assessment.",
  input_schema: {
    type: "object" as const,
    properties: {
      overallScore: {
        type: "integer",
        minimum: 0,
        maximum: 100,
        description: "0-100, overall fit for the role based strictly on what the notes actually describe — not on how the notes are written.",
      },
      strengths: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 3,
        description: "1-3 specific strengths, each referencing something actually described in the notes, not generic praise.",
      },
      concerns: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 3,
        description: "1-3 specific concerns or open questions — a gap versus the role's requirements, something unclear or under-probed.",
      },
      recommendation: {
        type: "string",
        description: "1-2 sentences of concrete guidance for the hiring team's next step — this is decision support, never a hire/no-hire directive.",
      },
    },
    required: ["overallScore", "strengths", "concerns", "recommendation"],
  },
};

// AI turns a manager's free-text interview notes into a structured
// assessment — modeled directly on scoreCaseStudyExercise's
// {score, strengths, gaps, recommendation} shape. Decision support the
// admin reviews, never an automated hiring decision. Includes the same
// bias-avoidance clause used in generateSuccessionReport.
export async function generateCandidateAssessment(candidateId: string): Promise<{ error: string } | { success: true }> {
  const { supabase, user, organizationId } = await requireAdmin();
  if (!user || !organizationId) return { error: "Not authorized" };

  const { data: candidate } = await supabase
    .from("hiring_candidates")
    .select("id, full_name, posting_id")
    .eq("id", candidateId)
    .eq("organization_id", organizationId)
    .maybeSingle<{ id: string; full_name: string; posting_id: string }>();
  if (!candidate) return { error: "Candidate not found" };

  const { data: posting } = await supabase
    .from("job_postings")
    .select("title, job_description")
    .eq("id", candidate.posting_id)
    .maybeSingle<{ title: string; job_description: string }>();

  const { data: notes } = await supabase
    .from("hiring_candidate_interview_notes")
    .select("note, created_at")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: true })
    .returns<{ note: string; created_at: string }[]>();
  if (!notes || notes.length === 0) {
    return { error: "Add at least one interview note first" };
  }

  const notesBlock = notes.map((n, i) => `Note ${i + 1}:\n${n.note}`).join("\n\n");

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1500,
      system:
        "You assess a hiring candidate's interview performance for Devometrics' Smart Hiring feature, from a hiring manager's own written notes. This is DECISION SUPPORT for the hiring team, never an automated hire/no-hire decision. Ground every judgment strictly in what the notes actually describe — never invent answers, credentials, or behavior the notes don't mention. Where the notes are thin or vague on a topic, say so as a concern rather than guessing favorably. Do not consider or mention age, gender, nationality, or anything other than the evidence in the notes.",
      tools: [RECORD_TOOL],
      tool_choice: { type: "tool", name: "record_candidate_assessment" },
      messages: [
        {
          role: "user",
          content: `CANDIDATE: ${candidate.full_name}\n\nROLE: ${posting?.title ?? "(unspecified)"}\n\nJOB DESCRIPTION:\n${posting?.job_description || "(none provided)"}\n\nMANAGER'S INTERVIEW NOTES (oldest to newest):\n${notesBlock}`,
        },
      ],
    });
    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") throw new Error("No structured output");
    const raw = toolUse.input as CandidateAssessment;
    const assessment: CandidateAssessment = {
      overallScore: Math.max(0, Math.min(100, Math.round(raw.overallScore))),
      strengths: raw.strengths ?? [],
      concerns: raw.concerns ?? [],
      recommendation: raw.recommendation ?? "",
    };

    const { error } = await supabase.from("hiring_candidate_assessments").upsert(
      {
        organization_id: organizationId,
        candidate_id: candidateId,
        assessment,
        based_on_note_count: notes.length,
        generated_by: user.id,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "candidate_id" }
    );
    if (error) {
      console.error("generateCandidateAssessment upsert failed:", error);
      return { error: "Assessed, but could not save the result — try again." };
    }
  } catch (err) {
    console.error("generateCandidateAssessment failed:", err);
    return { error: "Couldn't generate an assessment right now — try again in a moment." };
  }

  revalidatePath(`/dashboard/company/hiring/${candidate.posting_id}/candidates/${candidateId}`);
  return { success: true };
}
