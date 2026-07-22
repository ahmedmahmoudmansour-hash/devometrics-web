"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitSelfAssessment, acknowledgeReview } from "@/lib/performanceReviews/actions";
import { helpDraftReflection } from "@/lib/performanceReviews/ai";
import { reviewStatusLabel, COMPETENCY_RATING_LABELS, type ReviewDetail } from "@/lib/performanceReviews/types";

const GOAL_STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  achieved: "Achieved",
  missed: "Missed",
};

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

export default function MyPerformanceReview({ detail }: { detail: ReviewDetail }) {
  const router = useRouter();
  const { review, cycle, self, manager, goals, pastGoals, competencyRatings, uplineSignoffs } = detail;

  const [selfRating, setSelfRating] = useState(self?.rating ?? 3);
  const [selfReflection, setSelfReflection] = useState(self?.reflection ?? "");
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
      const result = await submitSelfAssessment(review.id, selfRating, selfReflection);
      if (result?.error) setSelfError(result.error);
      else router.refresh();
    });
  }

  function draftFromNotes() {
    setAiError(null);
    startAiTransition(async () => {
      const result = await helpDraftReflection(review.id, roughNotes);
      if ("error" in result) setAiError(result.error);
      else {
        setSelfReflection(result.reflection);
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
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{reviewStatusLabel(review.status)}</p>
        </div>
      </div>

      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>Your Reflection</p>
          <button type="button" onClick={() => setShowAiHelper((v) => !v)} style={aiButtonStyle()}>
            ✨ Help me write this
          </button>
        </div>

        {showAiHelper && (
          <div style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 8 }}>
              Jot down rough notes — bullet points are fine — and this turns them into a paragraph
              using only what you wrote.
            </p>
            <textarea
              value={roughNotes}
              onChange={(e) => setRoughNotes(e.target.value)}
              placeholder="e.g. shipped the onboarding redesign, mentored two juniors, struggled with the Q2 deadline crunch…"
              style={{ ...inputStyle(), minHeight: 60, resize: "vertical", fontFamily: "inherit" }}
            />
            {aiError && <p style={{ color: "#f87171", fontSize: 11.5, marginTop: 6 }}>{aiError}</p>}
            <button
              type="button"
              onClick={draftFromNotes}
              disabled={aiPending || !roughNotes.trim()}
              style={{ marginTop: 8, background: "#a78bfa", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: aiPending || !roughNotes.trim() ? 0.6 : 1 }}
            >
              {aiPending ? "Drafting…" : "Draft it"}
            </button>
          </div>
        )}

        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5, display: "block" }}>How would you rate this cycle? (1–5)</label>
        <select value={selfRating} onChange={(e) => setSelfRating(Number(e.target.value))} style={{ ...inputStyle(), cursor: "pointer", marginBottom: 10 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5, display: "block" }}>Reflection</label>
        <textarea
          value={selfReflection}
          onChange={(e) => setSelfReflection(e.target.value)}
          placeholder="What went well, what was hard, what you want to focus on next…"
          style={{ ...inputStyle(), minHeight: 90, resize: "vertical", fontFamily: "inherit" }}
        />
        {selfError && <p style={{ color: "#f87171", fontSize: 12, marginTop: 6 }}>{selfError}</p>}
        <button
          type="button"
          onClick={saveSelf}
          disabled={selfPending}
          style={{ marginTop: 10, background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: selfPending ? 0.6 : 1 }}
        >
          {selfPending ? "Saving…" : self?.submitted_at ? "Update your Reflection" : "Submit your Reflection"}
        </button>
        {self?.submitted_at && (
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
            Last submitted {new Date(self.submitted_at).toLocaleDateString()}
          </p>
        )}
      </div>

      {pastGoals.length > 0 && (
        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>Past Focus Areas (previous cycle)</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {pastGoals.map((g) => (
              <div key={g.id} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{g.title}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: `rgb(${GOAL_STATUS_COLOR[g.status]})`, whiteSpace: "nowrap" }}>{GOAL_STATUS_LABEL[g.status]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {goals.length > 0 && (
        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>Focus Areas for this cycle</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {goals.map((g) => (
              <div key={g.id} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <p style={{ fontSize: 13, color: "var(--text)" }}>{g.title}</p>
                    {g.description && <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{g.description}</p>}
                    {g.target && <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>Target: {g.target}{g.actual ? ` · Actual: ${g.actual}` : ""}</p>}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: `rgb(${GOAL_STATUS_COLOR[g.status]})`, background: `rgba(${GOAL_STATUS_COLOR[g.status]},0.12)`, border: `1px solid rgba(${GOAL_STATUS_COLOR[g.status]},0.35)`, borderRadius: 8, padding: "3px 8px", whiteSpace: "nowrap" }}>
                    {GOAL_STATUS_LABEL[g.status]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {competencyRatings.length > 0 && (
        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>Competencies — manager&apos;s view this cycle</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {competencyRatings.map((r) => (
              <div key={r.dimension} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12.5, color: "var(--text)" }}>{r.dimension}</span>
                <span style={{ fontSize: 11.5, color: "var(--teal)", fontWeight: 700 }}>{COMPETENCY_RATING_LABELS[r.rating]}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
            Single-source, manager-reported for this cycle — distinct from your measured Gap Analysis scores.
          </p>
        </div>
      )}

      {manager?.submitted_at ? (
        <div style={{ background: "var(--navy-mid)", border: "1px solid rgba(0,201,167,0.3)", borderRadius: 12, padding: 16 }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>Manager&apos;s Perspective</p>
          <p style={{ fontSize: 20, fontWeight: 800, color: "var(--teal)" }}>{manager.rating}/5</p>
          {manager.feedback && <p style={{ fontSize: 13, color: "var(--text)", marginTop: 8, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{manager.feedback}</p>}
          {manager.development_needs && (
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Development needs</p>
              <p style={{ fontSize: 13, color: "var(--text)", marginTop: 4, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{manager.development_needs}</p>
            </div>
          )}
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
            Shared {new Date(manager.submitted_at).toLocaleDateString()} — single-source, manager-reported, not independently verified.
          </p>

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            {review.employee_acknowledged_at ? (
              <p style={{ fontSize: 12.5, color: "var(--teal)" }}>
                ✓ Confirmed {new Date(review.employee_acknowledged_at).toLocaleDateString()}
                {review.employee_acknowledgment_comment ? ` — "${review.employee_acknowledgment_comment}"` : ""}
              </p>
            ) : (
              <>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5, display: "block" }}>
                  Confirm & close it out (optional comment)
                </label>
                <textarea
                  value={ackComment}
                  onChange={(e) => setAckComment(e.target.value)}
                  placeholder="Anything you want on record alongside your confirmation…"
                  style={{ ...inputStyle(), minHeight: 60, resize: "vertical", fontFamily: "inherit" }}
                />
                {ackError && <p style={{ color: "#f87171", fontSize: 12, marginTop: 6 }}>{ackError}</p>}
                <button
                  type="button"
                  onClick={saveAck}
                  disabled={ackPending}
                  style={{ marginTop: 8, background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: ackPending ? 0.6 : 1 }}
                >
                  {ackPending ? "Saving…" : "Confirm & close it out"}
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Your manager hasn&apos;t shared their Perspective yet.</p>
        </div>
      )}

      {uplineSignoffs.length > 0 && (
        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>Upline review</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {uplineSignoffs.map((s) => (
              <div key={s.manager_user_id} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 12px" }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                  {s.managerName} <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>· level {s.level}</span>
                </p>
                {s.comment && <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5 }}>{s.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {review.manager_closed_at && review.conclusion && (
        <div style={{ background: "var(--navy-mid)", border: "1px solid rgba(0,201,167,0.3)", borderRadius: 12, padding: 16 }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>Conclusion</p>
          <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{review.conclusion}</p>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
            Cycle closed {new Date(review.manager_closed_at).toLocaleDateString()}.
          </p>
        </div>
      )}
    </div>
  );
}
