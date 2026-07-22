"use client";

import { useState, useTransition } from "react";
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
import { COMPETENCY_DIMENSIONS } from "@/lib/gap-analysis/dimensions";
import {
  reviewStatusLabel,
  COMPETENCY_RATING_LABELS,
  type ReviewListItem,
  type ReviewGoal,
  type GoalStatus,
  type CompetencyRating,
  type UplineChainEntry,
  type UplineSignoff,
  type AppraisalCompetencyContext,
} from "@/lib/performanceReviews/types";

// Shared by both the admin's per-cycle roster (PerformanceReviewsManager)
// and a real reporting-line manager's "My Team" list (MyTeamReviews) — one
// row, one set of capabilities (Manager's Perspective, Focus Areas,
// Competencies, Conclusion), regardless of which surface is showing it.
// Authorization for who's actually allowed to act on a given row lives
// entirely server-side (RLS + the RPC functions' own is_org_admin /
// is_manager_of_user checks, migration 0078) — this component doesn't need
// to know or care which kind of caller it's rendering for.

const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  achieved: "Achieved",
  missed: "Missed",
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

function sectionLabelStyle(): React.CSSProperties {
  return { fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" };
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

function FocusAreasEditor({ reviewId, goals, pastGoals, onChanged }: { reviewId: string; goals: ReviewGoal[]; pastGoals: ReviewGoal[]; onChanged: () => void }) {
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [suggestions, setSuggestions] = useState<FocusAreaSuggestion[] | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  function add(t: string, tgt?: string) {
    if (!t.trim()) return;
    startTransition(async () => {
      await addReviewGoal(reviewId, t, undefined, tgt);
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
    <div style={{ marginTop: 12 }}>
      {pastGoals.length > 0 && (
        <div style={{ marginBottom: 12, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
          <p style={{ ...sectionLabelStyle(), marginBottom: 6 }}>Past Focus Areas (previous cycle)</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {pastGoals.map((g) => (
              <div key={g.id} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{g.title}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{GOAL_STATUS_LABEL[g.status]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <p style={sectionLabelStyle()}>Focus Areas</p>
        <button type="button" onClick={askAi} disabled={aiLoading} style={aiButtonStyle()}>
          {aiLoading ? "Thinking…" : "✨ Suggest with AI"}
        </button>
      </div>
      {goals.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>No Focus Areas set for this cycle yet.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
        {goals.map((g) => (
          <div key={g.id} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div>
                <span style={{ fontSize: 12.5, color: "var(--text)" }}>{g.title}</span>
                {g.target && <span style={{ fontSize: 11, color: "var(--text-muted)" }}> · target: {g.target}</span>}
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
                  {(Object.keys(GOAL_STATUS_LABEL) as GoalStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {GOAL_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => startTransition(async () => { await deleteReviewGoal(g.id); onChanged(); })}
                  style={{ background: "none", border: "none", color: "#f87171", fontSize: 11, cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>
            </div>
            {g.target && (
              <input
                defaultValue={g.actual ?? ""}
                placeholder="Actual result…"
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

      {aiError && <p style={{ color: "#f87171", fontSize: 11.5, marginBottom: 8 }}>{aiError}</p>}
      {suggestions && suggestions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10, background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 8, padding: 10 }}>
          <p style={{ fontSize: 10.5, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            AI suggestions — grounded in their Gap Analysis, pick what fits
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
                style={{ background: "rgba(0,201,167,0.1)", border: "1px solid rgba(0,201,167,0.3)", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "var(--teal)", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                + Add
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a Focus Area…"
          style={{ ...inputStyle(), fontSize: 12, flex: 2, minWidth: 140 }}
        />
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="Target (optional, e.g. a KPI)…"
          style={{ ...inputStyle(), fontSize: 12, flex: 1, minWidth: 120 }}
        />
        <button
          type="button"
          onClick={() => {
            add(title, target);
            setTitle("");
            setTarget("");
          }}
          disabled={isPending || !title.trim()}
          style={{ background: "rgba(0,201,167,0.1)", border: "1px solid rgba(0,201,167,0.3)", borderRadius: 8, padding: "0 14px", fontSize: 12, fontWeight: 700, color: "var(--teal)", cursor: "pointer", whiteSpace: "nowrap" }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

function CompetencyRatingsEditor({
  reviewId,
  ratings,
  context,
  onChanged,
}: {
  reviewId: string;
  ratings: CompetencyRating[];
  context: AppraisalCompetencyContext[];
  onChanged: () => void;
}) {
  const [suggestions, setSuggestions] = useState<CompetencyRatingSuggestion[] | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [, startTransition] = useTransition();

  const ratingByDim = new Map(ratings.map((r) => [r.dimension, r]));
  const contextByDim = new Map(context.map((c) => [c.dimension, c]));

  function save(dimension: string, rating: number, note: string) {
    startTransition(async () => {
      await setCompetencyRating(reviewId, dimension, rating, note);
      onChanged();
    });
  }

  function askAi() {
    setAiError(null);
    setAiLoading(true);
    setSuggestions(null);
    startTransition(async () => {
      const result = await suggestCompetencyRatings(reviewId);
      setAiLoading(false);
      if ("error" in result) setAiError(result.error);
      else setSuggestions(result.suggestions);
    });
  }

  function applyAll() {
    if (!suggestions) return;
    startTransition(async () => {
      await Promise.all(suggestions.map((s) => setCompetencyRating(reviewId, s.dimension, s.rating, s.note)));
      setSuggestions(null);
      onChanged();
    });
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <p style={sectionLabelStyle()}>Competencies</p>
        <button type="button" onClick={askAi} disabled={aiLoading} style={aiButtonStyle()}>
          {aiLoading ? "Thinking…" : "✨ Suggest with AI"}
        </button>
      </div>
      {aiError && <p style={{ color: "#f87171", fontSize: 11.5, marginBottom: 8 }}>{aiError}</p>}
      {suggestions && (
        <div style={{ marginBottom: 8 }}>
          <button type="button" onClick={applyAll} style={{ background: "rgba(0,201,167,0.1)", border: "1px solid rgba(0,201,167,0.3)", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "var(--teal)", cursor: "pointer" }}>
            Apply all AI suggestions below
          </button>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {COMPETENCY_DIMENSIONS.map((dim) => {
          const existing = ratingByDim.get(dim);
          const suggestion = suggestions?.find((s) => s.dimension === dim);
          const ctx = contextByDim.get(dim);
          return (
            <div key={dim} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "6px 10px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <span style={{ fontSize: 12, color: "var(--text)" }}>{dim}</span>
                  {ctx && (ctx.roleTarget !== null || ctx.measuredCurrent !== null) && (
                    <span style={{ fontSize: 10.5, color: "var(--text-muted)", marginLeft: 6 }}>
                      {ctx.measuredCurrent !== null ? `measured ${ctx.measuredCurrent}` : ""}
                      {ctx.measuredCurrent !== null && ctx.roleTarget !== null ? " · " : ""}
                      {ctx.roleTarget !== null ? `role needs ${ctx.roleTarget}` : ""}
                    </span>
                  )}
                </div>
                <select
                  defaultValue={suggestion?.rating ?? existing?.rating ?? 3}
                  onChange={(e) => save(dim, Number(e.target.value), existing?.note ?? suggestion?.note ?? "")}
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: "var(--text)", cursor: "pointer" }}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} — {COMPETENCY_RATING_LABELS[n]}
                    </option>
                  ))}
                </select>
              </div>
              {suggestion && !existing && (
                <p style={{ fontSize: 11, color: "#a78bfa", marginTop: 4 }}>AI: {suggestion.note}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConclusionSection({ item, canClose, onChanged }: { item: ReviewListItem; canClose: boolean; onChanged: () => void }) {
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
        <p style={sectionLabelStyle()}>Conclusion — closed</p>
        <p style={{ fontSize: 13, color: "var(--text)", marginTop: 6, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{item.conclusion}</p>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>Closed {new Date(item.manager_closed_at).toLocaleDateString()}</p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <p style={sectionLabelStyle()}>Conclusion</p>
        <button type="button" onClick={draftWithAi} disabled={aiLoading || !canClose} style={aiButtonStyle()}>
          {aiLoading ? "Drafting…" : "✨ Draft with AI"}
        </button>
      </div>
      {!canClose && <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 8 }}>Submit the Manager&apos;s Perspective first.</p>}
      {aiError && <p style={{ color: "#f87171", fontSize: 11.5, marginBottom: 8 }}>{aiError}</p>}
      <textarea
        value={conclusion}
        onChange={(e) => setConclusion(e.target.value)}
        placeholder="A short closing summary both sides can see — what happened this cycle, what's next."
        style={{ ...inputStyle(), minHeight: 70, resize: "vertical", fontFamily: "inherit" }}
      />
      {error && <p style={{ color: "#f87171", fontSize: 12, marginTop: 6 }}>{error}</p>}
      <button
        type="button"
        onClick={close}
        disabled={isPending || !canClose || !conclusion.trim()}
        style={{ marginTop: 8, background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", opacity: isPending || !canClose || !conclusion.trim() ? 0.5 : 1 }}
      >
        {isPending ? "Closing…" : "Close cycle"}
      </button>
    </div>
  );
}

// Shown only to whoever is actually in the chain (or an admin) — RLS is the
// real gate on what data even comes back, this just renders it. A skip-level
// manager sees an editable comment box for their own row; everyone else sees
// whatever's already been signed, read-only.
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
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  // Level 1 is the direct manager — already covered by Manager's
  // Perspective above, not repeated here.
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
      <p style={sectionLabelStyle()}>Upline review</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        {escalationChain.map((c) => {
          const existing = signoffByManager.get(c.managerUserId);
          const isMe = c.managerUserId === myUserId;
          return (
            <div key={c.managerUserId} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                  {c.managerName} <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>· level {c.level}</span>
                </span>
                {existing?.signed_off_at && (
                  <span style={{ fontSize: 10.5, color: "var(--teal)", fontWeight: 700 }}>
                    Co-signed {new Date(existing.signed_off_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              {isMe ? (
                <>
                  <textarea
                    defaultValue={existing?.comment ?? ""}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [c.managerUserId]: e.target.value }))}
                    placeholder="Optional comment — you're seeing this as a skip-level manager…"
                    style={{ ...inputStyle(), minHeight: 50, resize: "vertical", fontFamily: "inherit", marginTop: 6, fontSize: 12 }}
                  />
                  <button
                    type="button"
                    onClick={() => submit(c.managerUserId)}
                    disabled={isPending}
                    style={{ marginTop: 6, background: "rgba(0,201,167,0.1)", border: "1px solid rgba(0,201,167,0.3)", borderRadius: 6, padding: "5px 12px", fontSize: 11.5, fontWeight: 700, color: "var(--teal)", cursor: "pointer" }}
                  >
                    {existing?.signed_off_at ? "Update co-sign" : "Co-sign"}
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

export default function ImpactCycleReviewRow({ item, onChanged }: { item: ReviewListItem; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [goals, setGoals] = useState<ReviewGoal[]>([]);
  const [pastGoals, setPastGoals] = useState<ReviewGoal[]>([]);
  const [ratings, setRatings] = useState<CompetencyRating[]>([]);
  const [competencyContext, setCompetencyContext] = useState<AppraisalCompetencyContext[]>([]);
  const [uplineChain, setUplineChain] = useState<UplineChainEntry[]>([]);
  const [uplineSignoffs, setUplineSignoffs] = useState<UplineSignoff[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [rating, setRating] = useState(item.managerRating ?? 3);
  const [feedback, setFeedback] = useState("");
  const [developmentNeeds, setDevelopmentNeeds] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

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
  }

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (next) loadAll();
  }

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
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>
            {item.employeeName}
            {item.cycleName && <span style={{ color: "var(--text-muted)", fontWeight: 500 }}> — {item.cycleName}</span>}
          </p>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
            {reviewStatusLabel(item.status)}
            {item.selfRating !== null ? ` · Reflection ${item.selfRating}/5` : ""}
            {item.managerRating !== null ? ` · Perspective ${item.managerRating}/5` : ""}
          </p>
        </div>
        <button type="button" onClick={toggle} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 11.5, color: "var(--text-muted)", cursor: "pointer" }}>
          {expanded ? "Hide" : "Open"}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>Manager&apos;s Perspective</p>
            <button type="button" onClick={draftWithAi} disabled={aiLoading} style={aiButtonStyle()}>
              {aiLoading ? "Drafting…" : "✨ Draft with AI"}
            </button>
          </div>
          {aiError && <p style={{ color: "#f87171", fontSize: 11.5, marginBottom: 8 }}>{aiError}</p>}
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5, display: "block" }}>Rating (1–5)</label>
          <select value={rating} onChange={(e) => setRating(Number(e.target.value))} style={{ ...inputStyle(), cursor: "pointer", marginBottom: 10 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5, display: "block" }}>Feedback</label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="What went well, what to focus on next cycle…"
            style={{ ...inputStyle(), minHeight: 70, resize: "vertical", fontFamily: "inherit" }}
          />
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginTop: 10, marginBottom: 5, display: "block" }}>Development needs</label>
          <textarea
            value={developmentNeeds}
            onChange={(e) => setDevelopmentNeeds(e.target.value)}
            placeholder="What skill-building or support would help them grow from here…"
            style={{ ...inputStyle(), minHeight: 50, resize: "vertical", fontFamily: "inherit" }}
          />
          {error && <p style={{ color: "#f87171", fontSize: 12, marginTop: 6 }}>{error}</p>}
          <button
            type="button"
            onClick={save}
            disabled={isPending}
            style={{ marginTop: 8, background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}
          >
            {isPending ? "Saving…" : "Save Manager's Perspective"}
          </button>

          <FocusAreasEditor reviewId={item.id} goals={goals} pastGoals={pastGoals} onChanged={loadAll} />
          <CompetencyRatingsEditor reviewId={item.id} ratings={ratings} context={competencyContext} onChanged={loadAll} />
          <ConclusionSection item={item} canClose={item.managerRating !== null} onChanged={onChanged} />
          <UplineSignoffSection reviewId={item.id} chain={uplineChain} signoffs={uplineSignoffs} myUserId={myUserId} onChanged={loadAll} />
        </div>
      )}
    </div>
  );
}
