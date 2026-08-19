"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { submitSelfAssessment, acknowledgeReview, setSelfCompetencyRating } from "@/lib/performanceReviews/actions";
import { helpDraftRecommendations } from "@/lib/performanceReviews/ai";
import { reviewStatusLabel, competencyRatingLabel, goalStatusLabel, type ReviewDetail, type CompetencyRating } from "@/lib/performanceReviews/types";
import { describeCycleTimeline, describeReviewStage, TIMELINE_TONE_COLOR } from "@/lib/performanceReviews/timeline";
import { COMPETENCY_DIMENSIONS, dimensionLabel, type CompetencyDimension } from "@/lib/gap-analysis/dimensions";
import type { OrganizationCompetencyOption } from "@/lib/organizations/competencies";
import CustomStepResponseForm from "./CustomStepResponseForm";

const GOAL_STATUS_COLOR: Record<string, string> = {
  not_started: "148,163,184",
  in_progress: "0,201,167",
  achieved: "74,222,128",
  missed: "248,113,113",
};

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

function aiButtonStyle(): React.CSSProperties {
  return {
    background: "rgba(167,139,250,0.1)",
    border: "1px solid rgba(167,139,250,0.3)",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 11.5,
    fontWeight: 700,
    color: "#a78bfa",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

// Employee self-rating on competencies (migration 0132) — mirrors
// ImpactCycleReviewRow's own CompetencyRatingsEditor layout/auto-save
// pattern, but scoped to setSelfCompetencyRating (employee-only) and
// without that component's AI-suggestion machinery, which is manager/
// admin decision support, not something that belongs in the employee's
// own subjective self-rating. Each select saves on change, same as the
// manager-side editor — no separate submit button.
function SelfCompetencyRatingsEditor({
  reviewId,
  fixedDimensions,
  organizationCompetencies,
  ratings,
}: {
  reviewId: string;
  fixedDimensions: string[];
  organizationCompetencies: OrganizationCompetencyOption[];
  ratings: CompetencyRating[];
}) {
  const t = useTranslations("myPerformanceReview");
  const tLabels = useTranslations("performanceReviewLabels");
  const tDim = useTranslations("competencyDimensions");
  const router = useRouter();
  const [, startTransition] = useTransition();

  const ratingByDim = new Map(ratings.filter((r) => r.dimension && !r.organization_competency_id).map((r) => [r.dimension as string, r]));
  const ratingByOrgCompetency = new Map(ratings.filter((r) => r.organization_competency_id).map((r) => [r.organization_competency_id as string, r]));

  function save(dimension: string, rating: number, note: string, organizationCompetencyId?: string | null) {
    startTransition(async () => {
      await setSelfCompetencyRating(reviewId, dimension, rating, note, organizationCompetencyId);
      router.refresh();
    });
  }

  function renderRow(key: string, label: string, existing: CompetencyRating | undefined, onSave: (rating: number) => void) {
    return (
      <div key={key} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 12.5, color: "var(--text)" }}>{label}</span>
          <select
            defaultValue={existing?.self_rating ?? 3}
            onChange={(e) => onSave(Number(e.target.value))}
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", fontSize: 11, color: "var(--text)", cursor: "pointer" }}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} — {competencyRatingLabel(tLabels, n)}
              </option>
            ))}
          </select>
        </div>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
          {existing?.rating !== null && existing?.rating !== undefined
            ? t("managerRatedThis", { rating: competencyRatingLabel(tLabels, existing.rating) })
            : t("managerNotYetRated")}
        </p>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
      <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{t("rateYourCompetencies")}</p>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 10, lineHeight: 1.5 }}>{t("rateYourCompetenciesHint")}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {fixedDimensions.map((dim) => {
          const existing = ratingByDim.get(dim);
          const isFixedLabel = (COMPETENCY_DIMENSIONS as readonly string[]).includes(dim);
          const label = isFixedLabel ? dimensionLabel(tDim, dim as CompetencyDimension) : dim;
          return renderRow(dim, label, existing, (rating) => save(dim, rating, existing?.self_note ?? ""));
        })}
        {organizationCompetencies.map((c) => {
          const existing = ratingByOrgCompetency.get(c.id);
          return renderRow(c.id, c.name, existing, (rating) => save(c.mappedDimension ?? "", rating, existing?.self_note ?? "", c.id));
        })}
      </div>
    </div>
  );
}

export default function MyPerformanceReview({ detail }: { detail: ReviewDetail }) {
  const t = useTranslations("myPerformanceReview");
  const tLabels = useTranslations("performanceReviewLabels");
  const router = useRouter();
  const { review, cycle, self, manager, goals, pastGoals, competencyRatings, uplineSignoffs, instanceSteps, hasPendingDepartmentHeadReview } = detail;
  const stage = describeReviewStage(review.status, instanceSteps);
  const customSteps = instanceSteps.filter((s) => s.step_type === "custom");

  const [selfRating, setSelfRating] = useState(self?.rating ?? 3);
  const [selfReflection, setSelfReflection] = useState(self?.reflection ?? "");
  const [keyStrengths, setKeyStrengths] = useState(self?.key_strengths ?? "");
  const [recommendations, setRecommendations] = useState(self?.recommendations ?? "");
  const [developmentAreas, setDevelopmentAreas] = useState(self?.development_areas ?? "");
  const [selfError, setSelfError] = useState<string | null>(null);
  const [selfPending, startSelfTransition] = useTransition();

  const [showAiHelper, setShowAiHelper] = useState(false);
  const [roughNotes, setRoughNotes] = useState("");
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPending, startAiTransition] = useTransition();

  const [ackComment, setAckComment] = useState(review.employee_acknowledgment_comment ?? "");
  const [ackError, setAckError] = useState<string | null>(null);
  const [ackPending, startAckTransition] = useTransition();

  function saveSelf() {
    setSelfError(null);
    startSelfTransition(async () => {
      const result = await submitSelfAssessment(review.id, selfRating, selfReflection, keyStrengths, recommendations, developmentAreas);
      if (result?.error) setSelfError(result.error);
      else router.refresh();
    });
  }

  function draftFromNotes() {
    setAiError(null);
    startAiTransition(async () => {
      const result = await helpDraftRecommendations(review.id, roughNotes);
      if ("error" in result) setAiError(result.error);
      else {
        setRecommendations(result.recommendations);
        setShowAiHelper(false);
        setRoughNotes("");
      }
    });
  }

  function saveAck() {
    setAckError(null);
    startAckTransition(async () => {
      const result = await acknowledgeReview(review.id, ackComment);
      if (result?.error) setAckError(result.error);
      else router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{cycle.name}</p>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {reviewStatusLabel(tLabels, review.status)}
            {(() => {
              const timeline = describeCycleTimeline(cycle.opens_at, cycle.closes_at);
              return timeline ? (
                <span style={{ color: TIMELINE_TONE_COLOR[timeline.tone], fontWeight: 700 }}>
                  {" "}
                  · {t(`cycleTimeline.${timeline.key}`, { days: timeline.days })}
                </span>
              ) : null;
            })()}
          </p>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--teal)", marginTop: 4 }}>
            {t(`reviewStage.${stage}`)}
            {hasPendingDepartmentHeadReview && (
              <span style={{ color: "var(--text-muted)", fontWeight: 500 }}> · {t("departmentHeadReviewPending")}</span>
            )}
          </p>
        </div>
      </div>

      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
        <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>{t("yourReflection")}</p>

        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5, display: "block" }}>{t("howWouldYouRate")}</label>
        <select value={selfRating} onChange={(e) => setSelfRating(Number(e.target.value))} style={{ ...inputStyle(), cursor: "pointer", marginBottom: 10 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n} — {competencyRatingLabel(tLabels, n)}
            </option>
          ))}
        </select>
        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5, display: "block" }}>{t("reflectionLabel")}</label>
        <textarea
          value={selfReflection}
          onChange={(e) => setSelfReflection(e.target.value)}
          placeholder={t("reflectionPlaceholder")}
          style={{ ...inputStyle(), minHeight: 90, resize: "vertical", fontFamily: "inherit" }}
        />
        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5, marginTop: 12, display: "block" }}>{t("keyStrengthsLabel")}</label>
        <textarea
          value={keyStrengths}
          onChange={(e) => setKeyStrengths(e.target.value)}
          placeholder={t("keyStrengthsPlaceholder")}
          style={{ ...inputStyle(), minHeight: 60, resize: "vertical", fontFamily: "inherit" }}
        />
        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5, marginTop: 12, display: "block" }}>{t("developmentAreasLabel")}</label>
        <textarea
          value={developmentAreas}
          onChange={(e) => setDevelopmentAreas(e.target.value)}
          placeholder={t("developmentAreasPlaceholder")}
          style={{ ...inputStyle(), minHeight: 60, resize: "vertical", fontFamily: "inherit" }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, marginBottom: 5 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>{t("recommendationsLabel")}</label>
          <button type="button" onClick={() => setShowAiHelper((v) => !v)} style={aiButtonStyle()}>
            {t("helpMeWriteThis")}
          </button>
        </div>

        {showAiHelper && (
          <div style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 8, padding: 12, marginBottom: 8 }}>
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 8 }}>
              {t("roughNotesDesc")}
            </p>
            <textarea
              value={roughNotes}
              onChange={(e) => setRoughNotes(e.target.value)}
              placeholder={t("roughNotesPlaceholder")}
              style={{ ...inputStyle(), minHeight: 60, resize: "vertical", fontFamily: "inherit" }}
            />
            {aiError && <p style={{ color: "var(--danger)", fontSize: 11.5, marginTop: 6 }}>{aiError}</p>}
            <button
              type="button"
              onClick={draftFromNotes}
              disabled={aiPending || !roughNotes.trim()}
              style={{ marginTop: 8, background: "#a78bfa", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: aiPending || !roughNotes.trim() ? 0.6 : 1 }}
            >
              {aiPending ? t("drafting") : t("draftIt")}
            </button>
          </div>
        )}

        <textarea
          value={recommendations}
          onChange={(e) => setRecommendations(e.target.value)}
          placeholder={t("recommendationsPlaceholder")}
          style={{ ...inputStyle(), minHeight: 60, resize: "vertical", fontFamily: "inherit" }}
        />
        {selfError && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{selfError}</p>}
        <button
          type="button"
          onClick={saveSelf}
          disabled={selfPending}
          style={{ marginTop: 10, background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: selfPending ? 0.6 : 1 }}
        >
          {selfPending ? t("saving") : self?.submitted_at ? t("updateReflection") : t("submitReflection")}
        </button>
        {self?.submitted_at && (
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
            {t("lastSubmitted", { date: new Date(self.submitted_at).toLocaleDateString() })}
          </p>
        )}
      </div>

      {pastGoals.length > 0 && (
        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>{t("pastFocusAreas")}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {pastGoals.map((g) => (
              <div key={g.id} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{g.title}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: `rgb(${GOAL_STATUS_COLOR[g.status]})`, whiteSpace: "nowrap" }}>{goalStatusLabel(tLabels, g.status)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {goals.length > 0 && (
        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>{t("focusAreasForCycle")}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {goals.map((g) => (
              <div key={g.id} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <p style={{ fontSize: 13, color: "var(--text)" }}>{g.title}</p>
                    {g.description && <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{g.description}</p>}
                    {g.target && (
                      <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                        {t("target", { target: g.target })}{g.actual ? t("actualSuffix", { actual: g.actual }) : ""}
                      </p>
                    )}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: `rgb(${GOAL_STATUS_COLOR[g.status]})`, background: `rgba(${GOAL_STATUS_COLOR[g.status]},0.12)`, border: `1px solid rgba(${GOAL_STATUS_COLOR[g.status]},0.35)`, borderRadius: 8, padding: "3px 8px", whiteSpace: "nowrap" }}>
                    {goalStatusLabel(tLabels, g.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(() => {
        const competencyStep = instanceSteps.find((s) => s.step_type === "competency_ratings");
        if (!competencyStep && competencyRatings.length === 0) return null;
        const fixedDimensions =
          competencyStep && competencyStep.data.fixed_dimensions && competencyStep.data.fixed_dimensions.length > 0
            ? competencyStep.data.fixed_dimensions
            : competencyStep
              ? [...COMPETENCY_DIMENSIONS]
              : [...new Set(competencyRatings.filter((r) => r.dimension && !r.organization_competency_id).map((r) => r.dimension as string))];
        return (
          <SelfCompetencyRatingsEditor
            reviewId={review.id}
            fixedDimensions={fixedDimensions}
            organizationCompetencies={detail.competencyOrgOptions}
            ratings={competencyRatings}
          />
        );
      })()}

      {manager?.submitted_at ? (
        <div style={{ background: "var(--navy-mid)", border: "1px solid rgba(var(--teal-rgb),0.3)", borderRadius: 12, padding: 16 }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>{t("managersPerspective")}</p>
          <p style={{ fontSize: 20, fontWeight: 800, color: "var(--teal)" }}>
            {manager.rating}/5
            {manager.rating !== null && (
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)" }}> — {competencyRatingLabel(tLabels, manager.rating)}</span>
            )}
          </p>
          {manager.feedback && <p style={{ fontSize: 13, color: "var(--text)", marginTop: 8, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{manager.feedback}</p>}
          {manager.development_needs && (
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("developmentNeeds")}</p>
              <p style={{ fontSize: 13, color: "var(--text)", marginTop: 4, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{manager.development_needs}</p>
            </div>
          )}
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
            {t("sharedOn", { date: new Date(manager.submitted_at).toLocaleDateString() })}
          </p>

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            {review.employee_acknowledged_at ? (
              <p style={{ fontSize: 12.5, color: "var(--teal)" }}>
                {t("confirmed", { date: new Date(review.employee_acknowledged_at).toLocaleDateString() })}
                {review.employee_acknowledgment_comment ? ` — "${review.employee_acknowledgment_comment}"` : ""}
              </p>
            ) : (
              <>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5, display: "block" }}>
                  {t("confirmAndCloseLabel")}
                </label>
                <textarea
                  value={ackComment}
                  onChange={(e) => setAckComment(e.target.value)}
                  placeholder={t("confirmCommentPlaceholder")}
                  style={{ ...inputStyle(), minHeight: 60, resize: "vertical", fontFamily: "inherit" }}
                />
                {ackError && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{ackError}</p>}
                <button
                  type="button"
                  onClick={saveAck}
                  disabled={ackPending}
                  style={{ marginTop: 8, background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: ackPending ? 0.6 : 1 }}
                >
                  {ackPending ? t("saving") : t("confirmAndCloseButton")}
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("managerHasntShared")}</p>
        </div>
      )}

      {customSteps.length > 0 && (
        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
          {customSteps.map((step, i) => (
            <div key={step.id} style={i === 0 ? { marginTop: -16, paddingTop: 0, borderTop: "none" } : undefined}>
              <CustomStepResponseForm step={step} myUserId={review.employee_user_id} isReviewedEmployee canManageAssignments={false} />
            </div>
          ))}
        </div>
      )}

      {uplineSignoffs.length > 0 && (
        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>{t("uplineReview")}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {uplineSignoffs.map((s) => (
              <div key={s.manager_user_id} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 12px" }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                  {s.managerName} <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{t("level", { level: s.level })}</span>
                </p>
                {s.comment && <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5 }}>{s.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {review.manager_closed_at && review.conclusion && (
        <div style={{ background: "var(--navy-mid)", border: "1px solid rgba(var(--teal-rgb),0.3)", borderRadius: 12, padding: 16 }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>{t("conclusion")}</p>
          <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{review.conclusion}</p>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
            {t("cycleClosed", { date: new Date(review.manager_closed_at).toLocaleDateString() })}
          </p>
        </div>
      )}
    </div>
  );
}
