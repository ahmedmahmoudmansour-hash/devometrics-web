// Helpers for the competency library: standard competencies (fixed in the app, with
// descriptions and level indicators in the "competencyLibrary" messages) and company
// competencies (rows in organization_competencies), and the role requirements that
// point at either.

import { COMPETENCY_DIMENSIONS, dimensionTranslationKey, type CompetencyDimension } from "@/lib/gap-analysis/dimensions";
import { PROFICIENCY_LEVELS, type ProficiencyLevel } from "@/lib/proficiency/levels";

export const MAX_LEVEL_INDICATOR_LENGTH = 400;
export const COMPETENCY_CATEGORIES = ["behavioural", "technical", "functional"] as const;
export type CompetencyCategory = (typeof COMPETENCY_CATEGORIES)[number];

export function isCompetencyCategory(value: unknown): value is CompetencyCategory {
  return typeof value === "string" && (COMPETENCY_CATEGORIES as readonly string[]).includes(value);
}

// Message keys (namespace "competencyLibrary") for a standard competency.
export function standardDescriptionKey(dimension: CompetencyDimension): string {
  return `${dimensionTranslationKey(dimension)}Description`;
}
export function standardLevelKey(dimension: CompetencyDimension, level: ProficiencyLevel): string {
  return `${dimensionTranslationKey(dimension)}Level${level}`;
}

// What a person typed for each level -> what is stored: levels 1 to 5 only, text
// trimmed and capped, blanks dropped. Always returns an object, never throws.
export function cleanLevelIndicators(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  for (const level of PROFICIENCY_LEVELS) {
    const raw = (input as Record<string, unknown>)[String(level)];
    if (typeof raw !== "string") continue;
    const text = raw.trim().slice(0, MAX_LEVEL_INDICATOR_LENGTH);
    if (text) out[String(level)] = text;
  }
  return out;
}

// A role requirement is for a standard dimension, or for a company competency.
export type RequirementRow = { dimension?: string | null; competency_id?: string | null; target_level: number };

export function isStandardRequirement(r: RequirementRow): boolean {
  return !!r.dimension && !r.competency_id && (COMPETENCY_DIMENSIONS as readonly string[]).includes(r.dimension);
}
export function isCompanyRequirement(r: RequirementRow): boolean {
  return !!r.competency_id;
}

// Screens and calculations that only understand the eight standard dimensions
// (hiring scores, mobility, review targets) use this, so a requirement for a
// company competency is never read as a dimension.
export function standardRequirementsOnly<T extends RequirementRow>(rows: T[] | null | undefined): T[] {
  return (rows ?? []).filter(isStandardRequirement);
}

export function companyRequirementsOnly<T extends RequirementRow>(rows: T[] | null | undefined): T[] {
  return (rows ?? []).filter(isCompanyRequirement);
}

// ---------------------------------------------------------------------------
// Saving a role's requirements. Given what the person asked for and what already
// exists, work out what to write and what to remove. Pure, so it can be tested.
export type RequestedRequirement = { dimension?: string; competencyId?: string; targetLevel: number };

export type RequirementPlan = {
  standard: Map<string, number>; // dimension -> level to write
  company: Map<string, number>; // competency id -> level to write
  removeDimensions: string[]; // standard dimensions no longer required
  removeCompetencyIds: string[]; // company competencies no longer required
  rejected: string[]; // company competency ids that cannot be used (not this company's, or retired and new to the role)
};

export function planRequirementChanges(input: {
  requested: RequestedRequirement[];
  // company competencies the role already has a requirement for
  existingCompetencyIds: string[];
  // this company's competencies, by id (anything not in here is not theirs)
  competencies: Map<string, { isActive: boolean }>;
}): RequirementPlan {
  const level = (n: unknown) => {
    const v = Math.min(100, Math.max(0, Math.round(Number(n))));
    return Number.isFinite(v) ? v : 0;
  };
  const existing = new Set(input.existingCompetencyIds);
  const standard = new Map<string, number>();
  const company = new Map<string, number>();
  const rejected: string[] = [];

  for (const r of input.requested) {
    const lvl = level(r.targetLevel);
    if (r.competencyId) {
      const comp = input.competencies.get(r.competencyId);
      if (!comp || (!comp.isActive && !existing.has(r.competencyId))) {
        if (lvl > 0) rejected.push(r.competencyId);
        continue;
      }
      if (lvl > 0) company.set(r.competencyId, lvl);
    } else if (r.dimension && (COMPETENCY_DIMENSIONS as readonly string[]).includes(r.dimension)) {
      if (lvl > 0) standard.set(r.dimension, lvl);
    }
  }

  return {
    standard,
    company,
    removeDimensions: COMPETENCY_DIMENSIONS.filter((d) => !standard.has(d)),
    removeCompetencyIds: input.existingCompetencyIds.filter((id) => !company.has(id)),
    rejected,
  };
}
