// The canonical 5-step "getting started" journey (Discovery -> Assessments
// -> Gap Analysis -> Development Plan -> Resume), shared between the home
// dashboard's full OnboardingChecklist (app/dashboard/page.tsx, which needs
// the underlying rows/scores for other cards too) and the lightweight
// sidebar "what's next" nudge (lib/dashboard/onboardingStatus.ts, which only
// needs order + labels + hrefs). Keeping the order/labels/hrefs in one place
// means the two can't silently drift apart on what step comes next.
export const ONBOARDING_STEP_DEFS = [
  { labelKey: "step1Label", descriptionKey: "step1Description", href: "/dashboard/discovery" },
  { labelKey: "step2Label", descriptionKey: "step2Description", href: "/dashboard/assessments" },
  { labelKey: "step3Label", descriptionKey: "step3Description", href: "/dashboard/gap-analysis" },
  { labelKey: "step4Label", descriptionKey: "step4Description", href: "/dashboard/gap-analysis" },
  { labelKey: "step5Label", descriptionKey: "step5Description", href: "/dashboard/resume" },
] as const;
