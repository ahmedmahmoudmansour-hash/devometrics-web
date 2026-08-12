"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  getMyCustomStepAssignments,
  getCustomStepCompletion,
  getCustomStepResponses,
  getCustomStepAggregateForEmployee,
  getMyCustomStepResponse,
  submitCustomStepResponse,
} from "@/lib/performanceReviews/actions";
import { draftCustomStepResponse } from "@/lib/performanceReviews/customStepAi";
import type { InstanceStep, CustomStepConfig, CustomStepCompletion, CustomStepAggregate } from "@/lib/performanceReviews/workflowTypes";
import CustomStepAssigneePicker from "./CustomStepAssigneePicker";
import CustomStepCompletionBadge from "./CustomStepCompletionBadge";

function sectionLabelStyle(): React.CSSProperties {
  return { fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" };
}

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

function readConfig(step: InstanceStep): CustomStepConfig {
  const d = (step.data ?? {}) as Partial<CustomStepConfig>;
  return {
    custom_kind: d.custom_kind ?? "",
    response_shape: d.response_shape ?? "text",
    multi_respondent: d.multi_respondent ?? false,
    min_respondents: d.min_respondents ?? null,
    max_respondents: d.max_respondents ?? null,
    assignment: d.assignment ?? { mode: "manual" },
    anonymize_to_employee: d.anonymize_to_employee ?? false,
    ai_assist_enabled: d.ai_assist_enabled ?? true,
  };
}

// One generic component for every custom step — Peer Feedback, HR Review,
// Executive Approval, whatever an admin has named it — switching only on
// config.response_shape, never on custom_kind. Rendered from both
// ImpactCycleReviewRow (admin/manager view, with assignment management) and
// MyPerformanceReview (the reviewed employee's view, read-only except when
// they themselves are an assigned responder).
export default function CustomStepResponseForm({
  step,
  myUserId,
  isReviewedEmployee,
  canManageAssignments,
  organizationMembers,
}: {
  step: InstanceStep;
  myUserId: string | null;
  isReviewedEmployee: boolean;
  canManageAssignments: boolean;
  organizationMembers?: { userId: string; name: string; email: string }[];
}) {
  const t = useTranslations("customStepResponseForm");
  const config = readConfig(step);

  const [assignees, setAssignees] = useState<{ assigneeUserId: string; assigneeName: string }[]>([]);
  const [completion, setCompletion] = useState<CustomStepCompletion | null>(null);
  const [attributedResponses, setAttributedResponses] = useState<{ responderUserId: string; responderName: string; response: Record<string, unknown>; submittedAt: string | null }[]>([]);
  const [aggregate, setAggregate] = useState<CustomStepAggregate | null>(null);
  const [myResponse, setMyResponse] = useState<Record<string, unknown> | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [decision, setDecision] = useState<"approve" | "reject" | "">("");
  const [rating, setRating] = useState(3);
  const [comment, setComment] = useState("");
  const [text, setText] = useState("");
  const [roughNotes, setRoughNotes] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isAnonymousToEmployee = config.anonymize_to_employee && (config.custom_kind === "peer_feedback" || config.custom_kind === "360_feedback");
  const showAttributed = canManageAssignments || (isReviewedEmployee && !isAnonymousToEmployee);
  const showAggregate = isReviewedEmployee && isAnonymousToEmployee;

  const load = useCallback(() => {
    startTransition(async () => {
      const [a, c, myR] = await Promise.all([
        getMyCustomStepAssignments(step.id),
        getCustomStepCompletion(step.id),
        getMyCustomStepResponse(step.id),
      ]);
      setAssignees(a);
      setCompletion(c);
      setMyResponse(myR);
      if (myR) {
        setDecision((myR.decision as "approve" | "reject") ?? "approve");
        setRating(typeof myR.rating === "number" ? myR.rating : 3);
        setComment(typeof myR.comment === "string" ? myR.comment : "");
        setText(typeof myR.text === "string" ? myR.text : "");
      }

      if (canManageAssignments || (isReviewedEmployee && !isAnonymousToEmployee)) {
        setAttributedResponses(await getCustomStepResponses(step.id));
      }
      if (isReviewedEmployee && isAnonymousToEmployee) {
        setAggregate(await getCustomStepAggregateForEmployee(step.id));
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id]);

  const iAmAssigned = myUserId !== null && assignees.some((a) => a.assigneeUserId === myUserId);

  function submit() {
    setSaveError(null);
    if (config.response_shape === "approval" && decision === "") return;
    const response: Record<string, unknown> =
      config.response_shape === "approval"
        ? { decision, comment }
        : config.response_shape === "rating"
          ? { rating, comment }
          : { text };
    startTransition(async () => {
      const result = await submitCustomStepResponse(step.id, response);
      if (result?.error) setSaveError(result.error);
      else load();
    });
  }

  function draftWithAi() {
    setAiError(null);
    setAiLoading(true);
    startTransition(async () => {
      const result = await draftCustomStepResponse(step.id, roughNotes);
      setAiLoading(false);
      if ("error" in result) setAiError(result.error);
      else if (config.response_shape === "text") setText(result.draft);
      else setComment(result.draft);
    });
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>{step.title}</p>
        {loaded && <CustomStepCompletionBadge assignedCount={completion?.assigned_count ?? assignees.length} submittedCount={completion?.submitted_count ?? 0} minRequired={completion?.min_required ?? null} />}
      </div>
      {step.description && <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{step.description}</p>}

      {canManageAssignments && config.assignment.mode === "manual" && (
        <CustomStepAssigneePicker
          instanceStepId={step.id}
          options={organizationMembers ?? []}
          currentAssignees={assignees}
          multiRespondent={config.multi_respondent}
          onChanged={load}
        />
      )}
      {canManageAssignments && config.assignment.mode === "role" && assignees.length > 0 && (
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>{t("assignedTo", { names: assignees.map((a) => a.assigneeName).join(", ") })}</p>
      )}

      {iAmAssigned && (
        <div style={{ marginTop: 10, background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <p style={sectionLabelStyle()}>{myResponse ? t("yourResponseSubmitted") : t("yourResponse")}</p>
            {config.ai_assist_enabled && (
              <button
                type="button"
                onClick={draftWithAi}
                disabled={aiLoading}
                style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 8, padding: "6px 12px", fontSize: 11.5, fontWeight: 700, color: "#a78bfa", cursor: aiLoading ? "not-allowed" : "pointer", whiteSpace: "nowrap", opacity: aiLoading ? 0.6 : 1 }}
              >
                {aiLoading ? t("thinking") : t("helpMeDraft")}
              </button>
            )}
          </div>

          {config.ai_assist_enabled && (
            <input
              value={roughNotes}
              onChange={(e) => setRoughNotes(e.target.value)}
              placeholder={t("roughNotesPlaceholder")}
              style={{ ...inputStyle(), fontSize: 12, marginBottom: 6 }}
            />
          )}
          {aiError && <p style={{ color: "var(--danger)", fontSize: 11.5, marginBottom: 6 }}>{aiError}</p>}

          {config.response_shape === "approval" && (
            <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
              <select value={decision} onChange={(e) => setDecision(e.target.value as "approve" | "reject" | "")} style={{ ...inputStyle(), width: "auto", cursor: "pointer" }}>
                <option value="" disabled>
                  {t("selectOutcome")}
                </option>
                <option value="approve">{t("approve")}</option>
                <option value="reject">{t("reject")}</option>
              </select>
            </div>
          )}
          {config.response_shape === "rating" && (
            <select value={rating} onChange={(e) => setRating(Number(e.target.value))} style={{ ...inputStyle(), cursor: "pointer", marginBottom: 6 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          )}
          {config.response_shape === "text" ? (
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t("textPlaceholder")} style={{ ...inputStyle(), minHeight: 70, resize: "vertical", fontFamily: "inherit" }} />
          ) : (
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("commentPlaceholder")} style={{ ...inputStyle(), minHeight: 50, resize: "vertical", fontFamily: "inherit" }} />
          )}

          {saveError && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{saveError}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={isPending || (config.response_shape === "approval" && decision === "")}
            style={{
              marginTop: 8,
              background: "var(--teal)",
              color: "#0A0F1E",
              border: "none",
              borderRadius: 8,
              padding: "8px 16px",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: isPending || (config.response_shape === "approval" && decision === "") ? "not-allowed" : "pointer",
              opacity: isPending || (config.response_shape === "approval" && decision === "") ? 0.6 : 1,
            }}
          >
            {isPending ? t("saving") : myResponse ? t("updateResponse") : t("submitResponse")}
          </button>
        </div>
      )}

      {showAttributed && loaded && attributedResponses.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {attributedResponses.map((r) => (
            <div key={r.responderUserId} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 10px" }}>
              <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text)" }}>{r.responderName}</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.5 }}>
                {config.response_shape === "approval"
                  ? `${r.response.decision === "approve" ? t("approve") : t("reject")}${r.response.comment ? ` — ${r.response.comment}` : ""}`
                  : config.response_shape === "rating"
                    ? `${r.response.rating}/5${r.response.comment ? ` — ${r.response.comment}` : ""}`
                    : String(r.response.text ?? "")}
              </p>
            </div>
          ))}
        </div>
      )}

      {showAggregate && loaded && aggregate && (
        <div style={{ marginTop: 10, background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 10 }}>
          {!aggregate.ready ? (
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("stillCollecting", { submitted: aggregate.submitted_count, threshold: aggregate.threshold })}</p>
          ) : (
            <>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{t("anonymousPooled", { count: aggregate.submitted_count })}</p>
              {aggregate.avg_rating !== null && <p style={{ fontSize: 13, color: "var(--text)", marginBottom: 6 }}>{t("averageRating", { value: aggregate.avg_rating.toFixed(1) })}</p>}
              {(aggregate.approve_count !== null || aggregate.reject_count !== null) && (
                <p style={{ fontSize: 13, color: "var(--text)", marginBottom: 6 }}>{t("approvalSplit", { approve: aggregate.approve_count ?? 0, reject: aggregate.reject_count ?? 0 })}</p>
              )}
              {aggregate.comments && aggregate.comments.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {aggregate.comments.map((c, i) => (
                    <p key={i} style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5, fontStyle: "italic" }}>
                      &ldquo;{c}&rdquo;
                    </p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
