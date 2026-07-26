import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import type {
  JobPosting,
  JobPostingCompetencyRequirement,
  HiringCandidate,
  HiringCandidateCvScore,
  HiringCandidateInterviewNote,
  HiringCandidateAssessment,
} from "./types";

export type HiringOverview = {
  isOrgAdmin: boolean;
  organizationId: string | null;
  postings: (JobPosting & { candidateCount: number; hiredCount: number })[];
};

// Read-side aggregation, mirrors buildCompanyData()'s isolated-query
// pattern: a query error on a table this admin's org hasn't populated yet
// just yields an empty list here rather than breaking the page.
export async function buildHiringOverview(): Promise<HiringOverview> {
  const empty: HiringOverview = { isOrgAdmin: false, organizationId: null, postings: [] };

  const company = await buildCompanyData();
  if (!company.isOrgAdmin || !company.organizationId) return empty;

  const supabase = await createClient();
  const [{ data: postings }, { data: candidates }] = await Promise.all([
    supabase
      .from("job_postings")
      .select("*")
      .eq("organization_id", company.organizationId)
      .order("created_at", { ascending: false })
      .returns<JobPosting[]>(),
    supabase
      .from("hiring_candidates")
      .select("posting_id, stage")
      .eq("organization_id", company.organizationId)
      .returns<{ posting_id: string; stage: string }[]>(),
  ]);

  const countByPosting = new Map<string, { total: number; hired: number }>();
  for (const c of candidates ?? []) {
    const stats = countByPosting.get(c.posting_id) ?? { total: 0, hired: 0 };
    stats.total += 1;
    if (c.stage === "hired") stats.hired += 1;
    countByPosting.set(c.posting_id, stats);
  }

  return {
    isOrgAdmin: true,
    organizationId: company.organizationId,
    postings: (postings ?? []).map((p) => ({
      ...p,
      candidateCount: countByPosting.get(p.id)?.total ?? 0,
      hiredCount: countByPosting.get(p.id)?.hired ?? 0,
    })),
  };
}

export type JobPostingDetail = {
  isAuthorized: boolean;
  organizationId: string | null;
  posting: JobPosting | null;
  requirements: JobPostingCompetencyRequirement[];
  candidates: (HiringCandidate & { careerHealthScore: number | null; hasAssessment: boolean })[];
};

export async function buildJobPostingDetail(postingId: string): Promise<JobPostingDetail> {
  const empty: JobPostingDetail = {
    isAuthorized: false,
    organizationId: null,
    posting: null,
    requirements: [],
    candidates: [],
  };

  const company = await buildCompanyData();
  if (!company.isOrgAdmin || !company.organizationId) return empty;

  const supabase = await createClient();
  const { data: posting } = await supabase
    .from("job_postings")
    .select("*")
    .eq("id", postingId)
    .eq("organization_id", company.organizationId)
    .maybeSingle<JobPosting>();
  if (!posting) return empty;

  const [{ data: requirements }, { data: candidates }, { data: scores }, { data: assessments }] = await Promise.all([
    supabase
      .from("job_posting_competency_requirements")
      .select("*")
      .eq("posting_id", postingId)
      .returns<JobPostingCompetencyRequirement[]>(),
    supabase
      .from("hiring_candidates")
      .select("*")
      .eq("posting_id", postingId)
      .order("created_at", { ascending: false })
      .returns<HiringCandidate[]>(),
    supabase
      .from("hiring_candidate_cv_scores")
      .select("candidate_id, career_health_score")
      .eq("posting_id", postingId)
      .returns<{ candidate_id: string; career_health_score: number }[]>(),
    supabase
      .from("hiring_candidate_assessments")
      .select("candidate_id")
      .eq("organization_id", company.organizationId)
      .returns<{ candidate_id: string }[]>(),
  ]);

  const scoreByCandidateId = new Map((scores ?? []).map((s) => [s.candidate_id, s.career_health_score]));
  const assessedCandidateIds = new Set((assessments ?? []).map((a) => a.candidate_id));

  return {
    isAuthorized: true,
    organizationId: company.organizationId,
    posting,
    requirements: requirements ?? [],
    candidates: (candidates ?? []).map((c) => ({
      ...c,
      careerHealthScore: scoreByCandidateId.get(c.id) ?? null,
      hasAssessment: assessedCandidateIds.has(c.id),
    })),
  };
}

export type CandidateDetail = {
  isAuthorized: boolean;
  organizationId: string | null;
  candidate: HiringCandidate | null;
  posting: JobPosting | null;
  cvScore: HiringCandidateCvScore | null;
  notes: (HiringCandidateInterviewNote & { authorName: string })[];
  assessment: HiringCandidateAssessment | null;
};

// Single-candidate drill-down. Authorization is a direct same-organization
// check via buildCompanyData() (never just "some admin somewhere"), same
// posture as buildEmployeeDetail().
export async function buildCandidateDetail(candidateId: string): Promise<CandidateDetail> {
  const empty: CandidateDetail = {
    isAuthorized: false,
    organizationId: null,
    candidate: null,
    posting: null,
    cvScore: null,
    notes: [],
    assessment: null,
  };

  const company = await buildCompanyData();
  if (!company.isOrgAdmin || !company.organizationId) return empty;

  const supabase = await createClient();
  const { data: candidate } = await supabase
    .from("hiring_candidates")
    .select("*")
    .eq("id", candidateId)
    .eq("organization_id", company.organizationId)
    .maybeSingle<HiringCandidate>();
  if (!candidate) return empty;

  const [{ data: posting }, { data: cvScore }, { data: noteRows }, { data: assessment }] = await Promise.all([
    supabase.from("job_postings").select("*").eq("id", candidate.posting_id).maybeSingle<JobPosting>(),
    supabase
      .from("hiring_candidate_cv_scores")
      .select("*")
      .eq("candidate_id", candidateId)
      .maybeSingle<HiringCandidateCvScore>(),
    supabase
      .from("hiring_candidate_interview_notes")
      .select("*")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: true })
      .returns<HiringCandidateInterviewNote[]>(),
    supabase
      .from("hiring_candidate_assessments")
      .select("*")
      .eq("candidate_id", candidateId)
      .maybeSingle<HiringCandidateAssessment>(),
  ]);

  const authorIds = [...new Set((noteRows ?? []).map((n) => n.author_id))];
  const { data: authorProfiles } = authorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", authorIds).returns<{ id: string; full_name: string | null }[]>()
    : { data: [] as { id: string; full_name: string | null }[] };
  const authorNameById = new Map((authorProfiles ?? []).map((p) => [p.id, p.full_name ?? "Admin"]));

  return {
    isAuthorized: true,
    organizationId: company.organizationId,
    candidate,
    posting: posting ?? null,
    cvScore: cvScore ?? null,
    notes: (noteRows ?? []).map((n) => ({ ...n, authorName: authorNameById.get(n.author_id) ?? "Admin" })),
    assessment: assessment ?? null,
  };
}
