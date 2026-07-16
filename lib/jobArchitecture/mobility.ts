// The mobility engine — turns the Job Architecture (roles, grades, required
// competency profiles, and endorsed transitions) plus a person's measured
// competencies into an actual "where can I go and what does it take" picture.
// Entirely deterministic: no AI, no guessing — just distance between what a
// role requires and what the person has demonstrated. This is what makes
// "L&D Manager → Recruitment Manager (horizontal) / Head of HR (vertical)"
// a real, costed path rather than a label.
import type { CompetencyDimension } from "@/lib/gap-analysis/dimensions";
import type { JobRole, RoleCompetencyRequirement, RoleTransition } from "@/lib/supabase/types";

export type DevelopmentGap = {
  dimension: CompetencyDimension;
  current: number;
  required: number;
  gap: number;
};

export type MoveOption = {
  role: JobRole;
  // Only dimensions the person is short on, largest gap first — the actual
  // development work a move requires.
  developmentGaps: DevelopmentGap[];
  // 0-100 average attainment across the role's required dimensions — how
  // ready they are for this move today.
  readinessPercent: number;
};

export type UntappedRole = {
  role: JobRole;
  matchPercent: number;
  topGaps: DevelopmentGap[];
};

export type Mobility = {
  currentRole: JobRole | null;
  vertical: MoveOption[];
  horizontal: MoveOption[];
  // Roles the person is unexpectedly close to that AREN'T on an endorsed
  // path from their current role — the "untapped areas" nobody mapped.
  untapped: UntappedRole[];
  // False when the person has no gap analysis, so there's no measured signal
  // to compute development needs from (the UI says so honestly rather than
  // showing everyone as 0% ready).
  hasMeasuredData: boolean;
};

const UNTAPPED_MATCH_THRESHOLD = 60; // only surface genuinely close adjacencies
const UNTAPPED_LIMIT = 3;

function evaluateFit(
  role: JobRole,
  requirementsByRole: Map<string, RoleCompetencyRequirement[]>,
  levels: Partial<Record<CompetencyDimension, number>>
): { readinessPercent: number; developmentGaps: DevelopmentGap[]; hasRequirements: boolean } {
  const reqs = (requirementsByRole.get(role.id) ?? []).filter((r) => r.target_level > 0);
  if (reqs.length === 0) return { readinessPercent: 0, developmentGaps: [], hasRequirements: false };

  let attainmentSum = 0;
  const gaps: DevelopmentGap[] = [];
  for (const req of reqs) {
    const dim = req.dimension as CompetencyDimension;
    const current = levels[dim] ?? 0;
    attainmentSum += Math.min(1, current / req.target_level);
    if (req.target_level > current) {
      gaps.push({ dimension: dim, current, required: req.target_level, gap: req.target_level - current });
    }
  }
  gaps.sort((a, b) => b.gap - a.gap);
  return {
    readinessPercent: Math.round((attainmentSum / reqs.length) * 100),
    developmentGaps: gaps,
    hasRequirements: true,
  };
}

export function computeMobility(
  currentRoleId: string | null,
  levels: Partial<Record<CompetencyDimension, number>>,
  roles: JobRole[],
  requirements: RoleCompetencyRequirement[],
  transitions: RoleTransition[]
): Mobility {
  const hasMeasuredData = Object.keys(levels).length > 0;
  const roleById = new Map(roles.map((r) => [r.id, r]));
  const requirementsByRole = new Map<string, RoleCompetencyRequirement[]>();
  for (const req of requirements) {
    const list = requirementsByRole.get(req.role_id) ?? [];
    list.push(req);
    requirementsByRole.set(req.role_id, list);
  }

  const currentRole = currentRoleId ? roleById.get(currentRoleId) ?? null : null;

  const buildMove = (role: JobRole): MoveOption => {
    const fit = evaluateFit(role, requirementsByRole, levels);
    return { role, developmentGaps: fit.developmentGaps, readinessPercent: fit.readinessPercent };
  };

  // Endorsed paths from the current role, split by type. Ready-soonest first,
  // so the nearest move surfaces at the top.
  const explicitTargetIds = new Set<string>();
  const vertical: MoveOption[] = [];
  const horizontal: MoveOption[] = [];
  if (currentRole) {
    for (const t of transitions) {
      if (t.from_role_id !== currentRole.id) continue;
      const target = roleById.get(t.to_role_id);
      if (!target) continue;
      explicitTargetIds.add(target.id);
      (t.transition_type === "vertical" ? vertical : horizontal).push(buildMove(target));
    }
    vertical.sort((a, b) => b.readinessPercent - a.readinessPercent);
    horizontal.sort((a, b) => b.readinessPercent - a.readinessPercent);
  }

  // Untapped adjacencies: any role the person is genuinely close to that
  // isn't their current role and isn't already an endorsed target. Only
  // meaningful when there's measured data to compute proximity from.
  const untapped: UntappedRole[] = [];
  if (hasMeasuredData) {
    const candidates: UntappedRole[] = [];
    for (const role of roles) {
      if (currentRole && role.id === currentRole.id) continue;
      if (explicitTargetIds.has(role.id)) continue;
      const fit = evaluateFit(role, requirementsByRole, levels);
      if (!fit.hasRequirements) continue;
      if (fit.readinessPercent < UNTAPPED_MATCH_THRESHOLD) continue;
      candidates.push({ role, matchPercent: fit.readinessPercent, topGaps: fit.developmentGaps.slice(0, 3) });
    }
    candidates.sort((a, b) => b.matchPercent - a.matchPercent);
    untapped.push(...candidates.slice(0, UNTAPPED_LIMIT));
  }

  return { currentRole, vertical, horizontal, untapped, hasMeasuredData };
}
