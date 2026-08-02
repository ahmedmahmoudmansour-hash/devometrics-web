import { createClient } from "@/lib/supabase/server";
import type { CompanyData } from "@/lib/organizations/aggregate";
import { buildHiringOverview } from "@/lib/hiring/aggregate";
import { listOrgSurveys, type OrgSurveySummary } from "@/lib/surveys/actions";
import { COMPETENCY_DIMENSIONS, type CompetencyDimension } from "@/lib/gap-analysis/dimensions";
import type { SuccessionRole } from "@/lib/supabase/types";

// Devometrics has six separate org-facing aggregate modules today
// (organizations, hiring, surveys, succession, scorecard*, journey*) that
// each compute their own view independently — *scorecard and journey are
// per-individual, not org-wide, so they're out of scope here. An org
// admin currently has to click through six separate screens to see the
// full picture; nothing today combines them. This file is that synthesis
// layer: pull each already-computed real number, and surface the ones
// that actually need attention rather than just restating a full table.
//
// Deliberately excludes AI spend/credit figures — those are platform-
// admin-only by explicit product decision (see migration 0093's
// comment): a company's own admin should never see real dollar usage
// figures, so this view doesn't introduce a second place that could leak
// them.
//
// Each flag carries a stable `key` + structured params rather than a
// pre-built English sentence — same "stable identifier, translate at the
// UI layer" split used throughout this codebase (see e.g.
// lib/tasks/types.ts's categoryTranslationKey) — the page component maps
// key -> t(`companyOverviewPage.${key}`, params).

export type AttentionFlag =
  | { key: "lowDimension"; severity: "warning"; href: string; dimension: CompetencyDimension; score: number }
  | { key: "noManager"; severity: "info"; href: string; count: number; total: number }
  | { key: "lowSurveyParticipation"; severity: "warning"; href: string; title: string; percent: number; responses: number; assigned: number }
  | { key: "noSuccessor"; severity: "warning"; href: string; count: number; total: number }
  | { key: "openPostingsNoCandidates"; severity: "info"; href: string; count: number };

export type CompanyOverview = {
  hiring: { openPostings: number; totalCandidates: number; totalHired: number };
  surveys: OrgSurveySummary[];
  attention: AttentionFlag[];
};

const LOW_DIMENSION_THRESHOLD = 50;
const LOW_PARTICIPATION_THRESHOLD = 0.5;

// Takes the CompanyData the calling page already fetched via
// buildCompanyData() rather than re-fetching it — that call already does
// a full workforce-roster query, no reason to pay for it twice in the
// same request just to read a few fields off it.
export async function buildCompanyOverview(company: CompanyData): Promise<CompanyOverview> {
  const empty: CompanyOverview = {
    hiring: { openPostings: 0, totalCandidates: 0, totalHired: 0 },
    surveys: [],
    attention: [],
  };
  if (!company.isOrgAdmin || !company.organizationId) return empty;

  const [hiring, surveys, { data: successionRoles }] = await Promise.all([
    buildHiringOverview(),
    listOrgSurveys(),
    // Isolated defensive read, same posture as every other newer table in
    // this app — a query error before migration 0052 has run just yields
    // no succession section rather than breaking the whole overview.
    (async () => {
      const supabase = await createClient();
      return supabase
        .from("succession_roles")
        .select("id, title, report")
        .eq("organization_id", company.organizationId as string)
        .returns<Pick<SuccessionRole, "id" | "title" | "report">[]>();
    })(),
  ]);

  const attention: AttentionFlag[] = [];

  for (const dim of COMPETENCY_DIMENSIONS) {
    const avg = company.dimensionAverages[dim];
    if (avg !== undefined && avg < LOW_DIMENSION_THRESHOLD) {
      attention.push({ key: "lowDimension", severity: "warning", href: "/dashboard/company/analytics", dimension: dim, score: avg });
    }
  }

  const withoutManager = company.rows.filter((r) => !r.managerUserId).length;
  if (withoutManager > 0 && company.rows.length > 0) {
    attention.push({
      key: "noManager",
      severity: "info",
      href: "/dashboard/company/org-chart",
      count: withoutManager,
      total: company.rows.length,
    });
  }

  for (const s of surveys) {
    if (s.assignedCount > 0) {
      const rate = (s.responseCount ?? 0) / s.assignedCount;
      if (rate < LOW_PARTICIPATION_THRESHOLD) {
        attention.push({
          key: "lowSurveyParticipation",
          severity: "warning",
          href: "/dashboard/company/surveys",
          title: s.title,
          percent: Math.round(rate * 100),
          responses: s.responseCount ?? 0,
          assigned: s.assignedCount,
        });
      }
    }
  }

  const rolesWithoutSuccessor = (successionRoles ?? []).filter((r) => r.report && !r.report.hasStrongSuccessor);
  if (rolesWithoutSuccessor.length > 0) {
    attention.push({
      key: "noSuccessor",
      severity: "warning",
      href: "/dashboard/company/succession",
      count: rolesWithoutSuccessor.length,
      total: (successionRoles ?? []).length,
    });
  }

  const openPostingsWithNoCandidates = hiring.postings.filter((p) => p.status === "open" && p.candidateCount === 0);
  if (openPostingsWithNoCandidates.length > 0) {
    attention.push({
      key: "openPostingsNoCandidates",
      severity: "info",
      href: "/dashboard/company/hiring",
      count: openPostingsWithNoCandidates.length,
    });
  }

  return {
    hiring: {
      openPostings: hiring.postings.filter((p) => p.status === "open").length,
      totalCandidates: hiring.postings.reduce((sum, p) => sum + p.candidateCount, 0),
      totalHired: hiring.postings.reduce((sum, p) => sum + p.hiredCount, 0),
    },
    surveys,
    attention,
  };
}
