"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  submitManagerAssessment,
  addReviewGoal,
  updateGoalStatus,
  updateGoalActual,
  deleteReviewGoal,
  getReviewGoals,
  getPastGoals,
  getCompetencyRatings,
  setCompetencyRating,
  closeReview,
  getUplineChain,
  getUplineSignoffs,
  submitUplineSignoff,
  getAppraisalCompetencyContext,
  getMyUserId,
} from "@/lib/performanceReviews/actions";
import {
  suggestFocusAreas,
  draftManagerPerspective,
  suggestCompetencyRatings,
  draftConclusion,
  type FocusAreaSuggestion,
  type CompetencyRatingSuggestion,
} from "@/lib/performanceReviews/ai";
import { getOrganizationCompetenciesByIds, type OrganizationCompetencyOption } from "@/lib/organizations/competencies";
import { listOrganizationMembersForAssignment } from "@/lib/performanceReviews/workflowActions";
import { COMPETENCY_DIMENSIONS, dimensionLabel } from "@/lib/gap-analysis/dimensions";
import {
  reviewStatusLabel,
  competencyRatingLabel,
  goalStatusLabel,
  type ReviewListItem,
  type ReviewGoal,
  type GoalStatus,
  type CompetencyRating,
  type UplineChainEntry,
  type UplineSignoff,
  type AppraisalCompetencyContext,
} from "@/lib/performanceReviews/types";
import type { InstanceStep, CompetencyRatingsStepConfig } from "@/lib/performanceReviews/workflowTypes";
import CustomStepResponseForm from "./CustomStepResponseForm";

// Shared by both the admin's per-cycle roster (PerformanceReviewsManager)
// and a real reporting-line manager's "My Team" list (MyTeamReviews) — one
// row, rendering whichever steps this review's own workflow was configured
// with (migration 0103), in that configured order. When instanceSteps is
// empty (a database that hasn't run 0103 yet), it falls back to today's
// original fixed section order so nothing regresses.
// Authorization for who's actually allowed to act on a given row lives
// entirely server-side (RLS + the RPC functions' own is_org_admin /
// is_manager_of_user checks) — this component doesn't need to know or care
// which kind of caller it's rendering for.

const GOAL_STATUSES: GoalStatus[] = ["not_started", "in_progress", "achieved", "missed"];
// self_assessment added here alongside the SelfAssessmentSection read-only
// view above — it was deliberately absent before (the step type rendered
// nothing, so including it in the fallback order would have been a no-op).
const FALLBACK_STEP_TYPES: InstanceStep["step_type"][] = ["self_assessment", "goals", "competency_ratings", "manager_assessment", "conclusion"];

function inputStyle(): React.CSSProperties {
  return {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 13,
    color: "var(--text)",
    outline: "none",
    width: "100%",
  };
}

function sectionLabelStyle(): React.CSSProperties {
  return { fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" };
}

function aiButtonStyle(disabled?: boolean): React.CSSProperties {
  return {
    background: "rgba(167,139,250,0.1)",
    border: "1px solid rgba(167,139,250,0.3)",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 11.5,
    fontWeight: 700,
    color: "#a78bfa",
    cursor: disabled ? "not-allowed" : "pointer",
    whiteSpace: "nowrap",
    opacity: disabled ? 0.5 : 1,
  };
}

function FocusAreasEditor({
  reviewId,
  title,
  goals,
  pastGoals,
  onChanged,
}: {
  reviewId: string;
  title?: string;
  goals: ReviewGoal[];
  pastGoals: ReviewGoal[];
  onChanged: () => void;
}) {
  const t = useTranslations("impactCycleReviewRow");
  const tLabels = useTranslations("performanceReviewLabels");
  const [titleInput, setTitleInput] = useState("");
  const [target, setTarget] = useState("");
  const [suggestions, setSuggestions] = useState<FocusAreaSuggestion[] | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  function add(goalTitle: string, tgt?: string) {
    if (!goalTitle.trim()) return;
    startTransition(async () => {
      await addReviewGoal(reviewId, goalTitle, undefined, tgt);
      onChanged();
    });
  }

  function askAi() {
    setAiError(null);
    setAiLoading(true);
    setSuggestions(null);
    startTransition(async () => {
      const result = await suggestFocusAreas(reviewId);
      setAiLoading(false);
      if ("error" in result) setAiError(result.error);
      else setSuggestions(result.suggestions);
    });
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
      {pastGoals.length > 0 && (
        <div style={{ marginBottom: 12, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
          <p style={{ ...sectionLabelStyle(), marginBottom: 6 }}>{t("pastFocusAreas")}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {pastGoals.map((g) => (
              <div key={g.id} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{g.title}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{goalStatusLabel(tLabels, g.status)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <p style={sectionLabelStyle()}>{title ?? t("focusAreas")}</p>
        <button type="button" onClick={askAi} disabled={aiLoading} style={aiButtonStyle()}>
          {aiLoading ? t("thinking") : t("suggestWithAi")}
        </button>
      </div>
      {goals.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{t("noFocusAreasYet")}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
        {goals.map((g) => (
          <div key={g.id} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div>
                <span style={{ fontSize: 12.5, color: "var(--text)" }}>{g.title}</span>
                {g.target && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("targetSuffix", { target: g.target })}</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <select
                  value={g.status}
                  onChange={(e) =>
                    startTransition(async () => {
                      await updateGoalStatus(g.id, e.target.value as GoalStatus);
                      onChanged();
                    })
                  }
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: "var(--text)", cursor: "pointer" }}
                >
                  {GOAL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {goalStatusLabel(tLabels, s)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => startTransition(async () => { await deleteReviewGoal(g.id); onChanged(); })}
                  style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 11, cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>
            </div>
            {g.target && (
              <input
                defaultValue={g.actual ?? ""}
                placeholder={t("actualPlaceholder")}
                onBlur={(e) => {
                  if (e.target.value !== (g.actual ?? "")) {
                    startTransition(async () => {
                      await updateGoalActual(g.id, e.target.value);
                      onChanged();
                    });
                  }
                }}
                style={{ ...inputStyle(), fontSize: 11.5, padding: "5px 8px", marginTop: 6 }}
              />
            )}
          </div>
        ))}
      </div>

      {aiError && <p style={{ color: "var(--danger)", fontSize: 11.5, marginBottom: 8 }}>{aiError}</p>}
      {suggestions && suggestions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10, background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 8, padding: 10 }}>
          <p style={{ fontSize: 10.5, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {t("aiSuggestionsHeader")}
          </p>
          {suggestions.map((s, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div>
                <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>{s.title}</p>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{s.description}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  add(s.title);
                  setSuggestions((prev) => (prev ?? []).filter((_, idx) => idx !== i));
                }}
                style={{ background: "rgba(var(--teal-rgb),0.1)", border: "1px solid rgba(var(--teal-rgb),0.3)", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "var(--teal)", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                {t("add")}
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <input
          value={titleInput}
          onChange={(e) => setTitleInput(e.target.value)}
          placeholder={t("addFocusAreaPlaceholder")}
          style={{ ...inputStyle(), fontSize: 12, flex: 2, minWidth: 140 }}
        />
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder={t("targetPlaceholder")}
          style={{ ...inputStyle(), fontSize: 12, flex: 1, minWidth: 120 }}
        />
        <button
          type="button"
          onClick={() => {
            add(titleInput, target);
            setTitleInput("");
            setTarget("");
          }}
          disabled={isPending || !titleInput.trim()}
          style={{ background: "rgba(var(--teal-rgb),0.1)", border: "1px solid rgba(var(--teal-rgb),0.3)", borderRadius: 8, padding: "0 14px", fontSize: 12, fontWeight: 700, color: "var(--teal)", cursor: "pointer", whiteSpace: "nowrap" }}
        >
          {t("addButton")}
        </button>
      </div>
    </div>
  );
}

function CompetencyRatingsEditor({
  reviewId,
  title,
  config,
  ratings,
  organizationCompetencies,
  context,
  onChanged,
}: {
  reviewId: string;
  title?: string;
  config?: CompetencyRatingsStepConfig;
  ratings: CompetencyRating[];
  organizationCompetencies: OrganizationCompetencyOption[];
  context: AppraisalCompetencyContext[];
  onChanged: () => void;
}) {
  const t = useTranslations("impactCycleReviewRow");
  const tLabels = useTranslations("performanceReviewLabels");
  const tDim = useTranslations("competencyDimensions");
  const [suggestions, setSuggestions] = useState<CompetencyRatingSuggestion[] | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [, startTransition] = useTransition();

  const dimensionsToShow = config && config.fixed_dimensions.length > 0 ? config.fixed_dimensions : [...COMPETENCY_DIMENSIONS];
  const ratingByDim = new Map(ratings.filter((r) => r.dimension && !r.organization_competency_id).map((r) => [r.dimension as string, r]));
  const ratingByOrgCompetency = new Map(ratings.filter((r) => r.organization_competency_id).map((r) => [r.organization_competency_id as string, r]));
  const contextByDim = new Map(context.map((c) => [c.dimension, c]));

  function save(dimension: string, rating: number, note: string, organizationCompetencyId?: string | null) {
    startTransition(async () => {
      await setCompetencyRating(reviewId, dimension, rating, note, organizationCompetencyId);
      onChanged();
    });
  }

  function askAi() {
    setAiError(null);
    setAiLoading(true);
    setSuggestions(null);
    startTransition(async () => {
      const result = await suggestCompetencyRatings(reviewId, {
        fixedDimensions: dimensionsToShow,
        organizationCompetencyIds: organizationCompetencies.map((c) => c.id),
      });
      setAiLoading(false);
      if ("error" in result) setAiError(result.error);
      else setSuggestions(result.suggestions);
    });
  }

  function applyAll() {
    if (!suggestions) return;
    startTransition(async () => {
      await Promise.all(suggestions.map((s) => setCompetencyRating(reviewId, s.dimension, s.rating, s.note, s.organizationCompetencyId)));
      setSuggestions(null);
      onChanged();
    });
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <p style={sectionLabelStyle()}>{title ?? t("competencies")}</p>
        <button type="button" onClick={askAi} disabled={aiLoading} style={aiButtonStyle()}>
          {aiLoading ? t("thinking") : t("suggestWithAi")}
        </button>
      </div>
      {aiError && <p style={{ color: "var(--danger)", fontSize: 11.5, marginBottom: 8 }}>{aiError}</p>}
      {suggestions && (
        <div style={{ marginBottom: 8 }}>
          <button type="button" onClick={applyAll} style={{ background: "rgba(var(--teal-rgb),0.1)", border: "1px solid rgba(var(--teal-rgb),0.3)", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "var(--teal)", cursor: "pointer" }}>
            {t("applyAllSuggestions")}
          </button>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {dimensionsToShow.map((dim) => {
          const existing = ratingByDim.get(dim);
          const suggestion = suggestions?.find((s) => s.dimension === dim && !s.organizationCompetencyId);
          const ctx = contextByDim.get(dim);
          const isFixedLabel = (COMPETENCY_DIMENSIONS as readonly string[]).includes(dim);
          return (
            <div key={dim} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "6px 10px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <span style={{ fontSize: 12, color: "var(--text)" }}>{isFixedLabel ? dimensionLabel(tDim, dim as (typeof COMPETENCY_DIMENSIONS)[number]) : dim}</span>
                  {ctx && (ctx.roleTarget !== null || ctx.measuredCurrent !== null) && (
                    <span style={{ fontSize: 10.5, color: "var(--text-muted)", marginInlineStart: 6 }}>
                      {ctx.measuredCurrent !== null ? t("measured", { value: ctx.measuredCurrent }) : ""}
                      {ctx.measuredCurrent !== null && ctx.roleTarget !== null ? " · " : ""}
                      {ctx.roleTarget !== null ? t("roleNeeds", { value: ctx.roleTarget }) : ""}
                    </span>
                  )}
                </div>
                <select
                  defaultValue={suggestion?.rating ?? existing?.rating ?? existing?.self_rating ?? 3}
                  onChange={(e) => save(dim, Number(e.target.value), existing?.note ?? suggestion?.note ?? "")}
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: "var(--text)", cursor: "pointer" }}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} — {competencyRatingLabel(tLabels, n)}
                    </option>
                  ))}
                </select>
              </div>
              {suggestion && !existing && (
                <p style={{ fontSize: 11, color: "#a78bfa", marginTop: 4 }}>{t("aiNote", { note: suggestion.note })}</p>
              )}
              {existing?.self_rating !== null && existing?.self_rating !== undefined && (
                <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 4 }}>
                  {t("employeeSelfRated", { rating: competencyRatingLabel(tLabels, existing.self_rating) })}
                </p>
              )}
            </div>
          );
        })}

        {organizationCompetencies.map((c) => {
          const existing = ratingByOrgCompetency.get(c.id);
          const suggestion = suggestions?.find((s) => s.organizationCompetencyId === c.id);
          return (
            <div key={c.id} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "6px 10px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 12, color: "var(--text)" }}>{c.name}</span>
                <select
                  defaultValue={suggestion?.rating ?? existing?.rating ?? existing?.self_rating ?? 3}
                  onChange={(e) => save(c.mappedDimension ?? "", Number(e.target.value), existing?.note ?? suggestion?.note ?? "", c.id)}
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: "var(--text)", cursor: "pointer" }}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} — {competencyRatingLabel(tLabels, n)}
                    </option>
                  ))}
                </select>
              </div>
              {suggestion && !existing && (
                <p style={{ fontSize: 11, color: "#a78bfa", marginTop: 4 }}>{t("aiNote", { note: suggestion.note })}</p>
              )}
              {existing?.self_rating !== null && existing?.self_rating !== undefined && (
                <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 4 }}>
                  {t("employeeSelfRated", { rating: competencyRatingLabel(tLabels, existing.self_rating) })}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Read-only — the employee's own self-authored fields (rating/reflection
// live on ManagerAssessmentSection's own defaulting instead, see below).
// Previously this step type rendered nothing at all here (fell through the
// switch's default case); the employee's reflection was never visible to
// an admin/manager anywhere except indirectly via the numeric selfRating
// badge in the row header.
function SelfAssessmentSection({ item, title }: { item: ReviewListItem; title?: string }) {
  const t = useTranslations("impactCycleReviewRow");
  const fields: { label: string; value: string | null }[] = [
    { label: t("reflectionLabel"), value: item.selfReflection },
    { label: t("keyStrengthsLabel"), value: item.selfKeyStrengths },
    { label: t("developmentAreasLabel"), value: item.selfDevelopmentAreas },
    { label: t("recommendationsLabel"), value: item.selfRecommendations },
  ].filter((f) => f.value);

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
      <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>{title ?? t("selfAssessmentTitle")}</p>
      {fields.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("selfAssessmentNoneYet")}</p>
      ) : (
        fields.map((f) => (
          <div key={f.label} style={{ marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{f.label}</p>
            <p style={{ fontSize: 13, color: "var(--text)", marginTop: 4, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{f.value}</p>
          </div>
        ))
      )}
    </div>
  );
}

function ManagerAssessmentSection({
  item,
  title,
  onChanged,
}: {
  item: ReviewListItem;
  title?: string;
  onChanged: () => void;
}) {
  const t = useTranslations("impactCycleReviewRow");
  const tLabels = useTranslations("performanceReviewLabels");
  // Defaults from the employee's own self-rating rather than a flat 3 —
  // matches the CEO's framing verbatim ("manager can verify the employee
  // self-score"). Still falls back to 3 when no self-assessment exists yet
  // (e.g. the manager submits before the employee does). The manager's
  // eventual submitted rating is stored as its own independent value either
  // way — this only changes the form's starting point, never overwrites
  // anything.
  const [rating, setRating] = useState(item.managerRating ?? item.selfRating ?? 3);
  const [feedback, setFeedback] = useState("");
  const [developmentNeeds, setDevelopmentNeeds] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await submitManagerAssessment(item.id, rating, feedback, developmentNeeds);
      if (result?.error) setError(result.error);
      else onChanged();
    });
  }

  function draftWithAi() {
    setAiError(null);
    setAiLoading(true);
    startTransition(async () => {
      const result = await draftManagerPerspective(item.id);
      setAiLoading(false);
      if ("error" in result) setAiError(result.error);
      else {
        setRating(result.rating);
        setFeedback(result.feedback);
        setDevelopmentNeeds(result.developmentNeeds);
      }
    });
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>{title ?? t("managersPerspective")}</p>
        <button type="button" onClick={draftWithAi} disabled={aiLoading} style={aiButtonStyle()}>
          {aiLoading ? t("drafting") : t("draftWithAi")}
        </button>
      </div>
      {aiError && <p style={{ color: "var(--danger)", fontSize: 11.5, marginBottom: 8 }}>{aiError}</p>}
      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5, display: "block" }}>{t("ratingLabel")}</label>
      <select value={rating} onChange={(e) => setRating(Number(e.target.value))} style={{ ...inputStyle(), cursor: "pointer", marginBottom: 10 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            {n} — {competencyRatingLabel(tLabels, n)}
          </option>
        ))}
      </select>
      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5, display: "block" }}>{t("feedbackLabel")}</label>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder={t("feedbackPlaceholder")}
        style={{ ...inputStyle(), minHeight: 70, resize: "vertical", fontFamily: "inherit" }}
      />
      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginTop: 10, marginBottom: 5, display: "block" }}>{t("developmentNeedsLabel")}</label>
      <textarea
        value={developmentNeeds}
        onChange={(e) => setDevelopmentNeeds(e.target.value)}
        placeholder={t("developmentNeedsPlaceholder")}
        style={{ ...inputStyle(), minHeight: 50, resize: "vertical", fontFamily: "inherit" }}
      />
      {error && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{error}</p>}
      <button
        type="button"
        onClick={save}
        disabled={isPending}
        style={{ marginTop: 8, background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}
      >
        {isPending ? t("saving") : t("saveManagersPerspective")}
      </button>
    </div>
  );
}

function ConclusionSection({ item, title, canClose, onChanged }: { item: ReviewListItem; title?: string; canClose: boolean; onChanged: () => void }) {
  const t = useTranslations("impactCycleReviewRow");
  const [conclusion, setConclusion] = useState(item.conclusion ?? "");
  const [error, setError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  function draftWithAi() {
    setAiError(null);
    setAiLoading(true);
    startTransition(async () => {
      const result = await draftConclusion(item.id);
      setAiLoading(false);
      if ("error" in result) setAiError(result.error);
      else setConclusion(result.conclusion);
    });
  }

  function close() {
    setError(null);
    startTransition(async () => {
      const result = await closeReview(item.id, conclusion);
      if (result?.error) setError(result.error);
      else onChanged();
    });
  }

  if (item.manager_closed_at) {
    return (
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
        <p style={sectionLabelStyle()}>{t("conclusionClosed")}</p>
        <p style={{ fontSize: 13, color: "var(--text)", marginTop: 6, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{item.conclusion}</p>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>{t("closed", { date: new Date(item.manager_closed_at).toLocaleDateString() })}</p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, opacity: canClose ? 1 : 0.6 }}>
        <p style={sectionLabelStyle()}>{title ?? t("conclusion")}</p>
        <button type="button" onClick={draftWithAi} disabled={aiLoading || !canClose} style={aiButtonStyle(!canClose)}>
          {aiLoading ? t("drafting") : t("draftWithAi")}
        </button>
      </div>
      {!canClose && (
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
          <span aria-hidden="true">🔒</span> {t("submitPerspectiveFirst")}
        </p>
      )}
      {aiError && <p style={{ color: "var(--danger)", fontSize: 11.5, marginBottom: 8 }}>{aiError}</p>}
      <textarea
        value={conclusion}
        onChange={(e) => setConclusion(e.target.value)}
        placeholder={t("conclusionPlaceholder")}
        disabled={!canClose}
        style={{ ...inputStyle(), minHeight: 70, resize: "vertical", fontFamily: "inherit", opacity: canClose ? 1 : 0.5, cursor: canClose ? "text" : "not-allowed" }}
      />
      {error && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{error}</p>}
      <button
        type="button"
        onClick={close}
        disabled={isPending || !canClose || !conclusion.trim()}
        title={!canClose ? t("submitPerspectiveFirst") : undefined}
        style={{ marginTop: 8, background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, fontWeight: 700, cursor: !canClose ? "not-allowed" : "pointer", opacity: isPending || !canClose || !conclusion.trim() ? 0.5 : 1 }}
      >
        {isPending ? t("closing") : t("closeCycle")}
      </button>
    </div>
  );
}

// Shown only to whoever is actually in the chain (or an admin) — RLS is the
// real gate on what data even comes back, this just renders it. A skip-level
// manager sees an editable comment box for their own row; everyone else sees
// whatever's already been signed, read-only. Escalation stays a separate
// cross-cutting mechanism, not a configurable step — see migration 0103's
// header for why.
function UplineSignoffSection({
  reviewId,
  chain,
  signoffs,
  myUserId,
  onChanged,
}: {
  reviewId: string;
  chain: UplineChainEntry[];
  signoffs: UplineSignoff[];
  myUserId: string | null;
  onChanged: () => void;
}) {
  const t = useTranslations("impactCycleReviewRow");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const escalationChain = chain.filter((c) => c.level >= 2);
  if (escalationChain.length === 0) return null;

  const signoffByManager = new Map(signoffs.map((s) => [s.manager_user_id, s]));

  function submit(managerUserId: string) {
    startTransition(async () => {
      await submitUplineSignoff(reviewId, drafts[managerUserId] ?? "");
      onChanged();
    });
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
      <p style={sectionLabelStyle()}>{t("uplineReview")}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        {escalationChain.map((c) => {
          const existing = signoffByManager.get(c.managerUserId);
          const isMe = c.managerUserId === myUserId;
          return (
            <div key={c.managerUserId} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                  {c.managerName} <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{t("level", { level: c.level })}</span>
                </span>
                {existing?.signed_off_at && (
                  <span style={{ fontSize: 10.5, color: "var(--teal)", fontWeight: 700 }}>
                    {t("coSigned", { date: new Date(existing.signed_off_at).toLocaleDateString() })}
                  </span>
                )}
              </div>
              {isMe ? (
                <>
                  <textarea
                    defaultValue={existing?.comment ?? ""}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [c.managerUserId]: e.target.value }))}
                    placeholder={t("coSignCommentPlaceholder")}
                    style={{ ...inputStyle(), minHeight: 50, resize: "vertical", fontFamily: "inherit", marginTop: 6, fontSize: 12 }}
                  />
                  <button
                    type="button"
                    onClick={() => submit(c.managerUserId)}
                    disabled={isPending}
                    style={{ marginTop: 6, background: "rgba(var(--teal-rgb),0.1)", border: "1px solid rgba(var(--teal-rgb),0.3)", borderRadius: 6, padding: "5px 12px", fontSize: 11.5, fontWeight: 700, color: "var(--teal)", cursor: "pointer" }}
                  >
                    {existing?.signed_off_at ? t("updateCoSign") : t("coSign")}
                  </button>
                </>
              ) : (
                existing?.comment && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>{existing.comment}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ImpactCycleReviewRow({
  item,
  onChanged,
  canExport,
}: {
  item: ReviewListItem;
  onChanged: () => void;
  // Org-admin-only (per Ahmed: not the employee, not their manager) — only
  // PerformanceReviewsManager (the admin's Impact Cycles page) passes this;
  // MyTeamReviews (the manager's own page) never does. The docx route
  // itself is the real gate (getReviewExportData re-checks isOrgAdmin), so
  // this prop only controls whether the button is offered, not whether the
  // download would work if someone reached the URL directly.
  canExport?: boolean;
}) {
  const t = useTranslations("impactCycleReviewRow");
  const tLabels = useTranslations("performanceReviewLabels");
  const [expanded, setExpanded] = useState(false);
  const [goals, setGoals] = useState<ReviewGoal[]>([]);
  const [pastGoals, setPastGoals] = useState<ReviewGoal[]>([]);
  const [ratings, setRatings] = useState<CompetencyRating[]>([]);
  const [orgCompetencies, setOrgCompetencies] = useState<OrganizationCompetencyOption[]>([]);
  const [competencyContext, setCompetencyContext] = useState<AppraisalCompetencyContext[]>([]);
  const [uplineChain, setUplineChain] = useState<UplineChainEntry[]>([]);
  const [uplineSignoffs, setUplineSignoffs] = useState<UplineSignoff[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [organizationMembers, setOrganizationMembers] = useState<{ userId: string; name: string; email: string }[]>([]);

  async function loadAll() {
    const [g, pg, r, ctx, chain, signoffs, uid] = await Promise.all([
      getReviewGoals(item.id),
      getPastGoals(item.id),
      getCompetencyRatings(item.id),
      getAppraisalCompetencyContext(item.id),
      getUplineChain(item.id),
      getUplineSignoffs(item.id),
      getMyUserId(),
    ]);
    setGoals(g);
    setPastGoals(pg);
    setRatings(r);
    setCompetencyContext(ctx);
    setUplineChain(chain);
    setUplineSignoffs(signoffs);
    setMyUserId(uid);

    const competencyStep = item.instanceSteps.find((s) => s.step_type === "competency_ratings");
    const orgCompetencyIds = competencyStep?.data.organization_competency_ids ?? [];
    if (orgCompetencyIds.length > 0) setOrgCompetencies(await getOrganizationCompetenciesByIds(orgCompetencyIds));

    const hasManualCustomStep = item.instanceSteps.some((s) => s.step_type === "custom" && s.data.assignment?.mode === "manual");
    if (hasManualCustomStep) setOrganizationMembers(await listOrganizationMembersForAssignment(item.organization_id));
  }

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (next) loadAll();
  }

  const hasManagerAssessmentStep = item.instanceSteps.length === 0 || item.instanceSteps.some((s) => s.step_type === "manager_assessment");
  const stepsToRender = item.instanceSteps.length > 0 ? item.instanceSteps : FALLBACK_STEP_TYPES.map((step_type, i) => ({ id: `fallback-${step_type}`, review_id: item.id, workflow_step_id: null, position: i, step_type, title: "", description: null, data: {}, submitted_at: null, created_at: "" }) as InstanceStep);

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>
            {item.employeeName}
            {item.cycleName && <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{t("cycleNamePrefix", { cycleName: item.cycleName })}</span>}
          </p>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
            {reviewStatusLabel(tLabels, item.status)}
            {item.selfRating !== null ? t("reflectionScore", { rating: item.selfRating }) : ""}
            {item.managerRating !== null ? t("perspectiveScore", { rating: item.managerRating }) : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {canExport && (
            <a
              href={`/api/performance-reviews/${item.id}/export/docx`}
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 11.5, color: "var(--text-muted)", textDecoration: "none" }}
            >
              {t("exportWord")}
            </a>
          )}
          <button type="button" onClick={toggle} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 11.5, color: "var(--text-muted)", cursor: "pointer" }}>
            {expanded ? t("hide") : t("open")}
          </button>
        </div>
      </div>

      {expanded && (
        <div>
          {stepsToRender.map((step) => {
            switch (step.step_type) {
              case "self_assessment":
                return <SelfAssessmentSection key={step.id} item={item} title={step.title || undefined} />;
              case "manager_assessment":
                return <ManagerAssessmentSection key={step.id} item={item} title={step.title || undefined} onChanged={onChanged} />;
              case "goals":
                return <FocusAreasEditor key={step.id} reviewId={item.id} title={step.title || undefined} goals={goals} pastGoals={pastGoals} onChanged={loadAll} />;
              case "competency_ratings":
                return (
                  <CompetencyRatingsEditor
                    key={step.id}
                    reviewId={item.id}
                    title={step.title || undefined}
                    config={item.instanceSteps.length > 0 ? { fixed_dimensions: step.data.fixed_dimensions ?? [], organization_competency_ids: step.data.organization_competency_ids ?? [] } : undefined}
                    ratings={ratings}
                    organizationCompetencies={orgCompetencies}
                    context={competencyContext}
                    onChanged={loadAll}
                  />
                );
              case "conclusion":
                return <ConclusionSection key={step.id} item={item} title={step.title || undefined} canClose={hasManagerAssessmentStep ? item.managerRating !== null : true} onChanged={onChanged} />;
              case "custom":
                return (
                  <CustomStepResponseForm
                    key={step.id}
                    step={step}
                    myUserId={myUserId}
                    isReviewedEmployee={false}
                    canManageAssignments
                    organizationMembers={organizationMembers}
                  />
                );
              default:
                return null;
            }
          })}
          <UplineSignoffSection reviewId={item.id} chain={uplineChain} signoffs={uplineSignoffs} myUserId={myUserId} onChanged={loadAll} />
        </div>
      )}
    </div>
  );
}
