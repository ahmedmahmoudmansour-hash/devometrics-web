// Fixed internal field keys for compensation, with an org-level display-
// label override layer — same shape as lib/gap-analysis/dimensions.ts's
// COMPETENCY_DIMENSIONS + compensation_terminology mirroring
// organization_competencies (migration 0035). Backend/workflow code always
// reads/writes these canonical keys; only the UI resolves an org's label
// override (falling back to the translated default when none exists).
// An org's override has no i18n of its own — rendered verbatim, same as
// organization_competencies.name.
export const COMPENSATION_FIELD_KEYS = [
  "base_salary",
  "salary_band",
  "compensation_review",
  "compensation_change",
  "compensation_proposal",
  "people_manager",
  "monthly_deduction",
] as const;

export type CompensationFieldKey = (typeof COMPENSATION_FIELD_KEYS)[number];

const FIELD_TRANSLATION_KEY: Record<CompensationFieldKey, string> = {
  base_salary: "baseSalary",
  salary_band: "salaryBand",
  compensation_review: "compensationReview",
  compensation_change: "compensationChange",
  compensation_proposal: "compensationProposal",
  people_manager: "peopleManager",
  monthly_deduction: "monthlyDeduction",
};

export function isCompensationFieldKey(value: string): value is CompensationFieldKey {
  return (COMPENSATION_FIELD_KEYS as readonly string[]).includes(value);
}

// `overrides` is the org's compensation_terminology rows, keyed by field —
// callers fetch this once per page load, not per label lookup.
export function compensationFieldLabel(
  t: (key: string) => string,
  overrides: Map<string, string>,
  field: CompensationFieldKey
): string {
  return overrides.get(field) ?? t(FIELD_TRANSLATION_KEY[field]);
}
