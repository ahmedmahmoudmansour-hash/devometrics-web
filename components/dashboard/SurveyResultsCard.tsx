"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getSurveyResults, getSurveyForEditing, type OrgSurveySummary, type SurveyResults } from "@/lib/surveys/actions";
import { surveyThemeLabel } from "@/lib/surveys/types";
import type { SurveyQuestion } from "@/lib/surveys/types";
import SurveyBuilder from "./SurveyBuilder";

type EditableSurvey = { id: string; title: string; theme: string; questions: SurveyQuestion[] };

export default function SurveyResultsCard({ survey }: { survey: OrgSurveySummary }) {
  const t = useTranslations("surveyResultsCard");
  const tThemes = useTranslations("surveyThemes");
  const [expanded, setExpanded] = useState(false);
  const [results, setResults] = useState<SurveyResults | { error: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [editingSurvey, setEditingSurvey] = useState<EditableSurvey | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const router = useRouter();

  // Editing is only ever offered before anyone has responded — matches
  // updateSurvey's own atomic guard, this is just the UI-level reflection
  // of the same rule (not the actual enforcement point).
  const canEdit = (survey.responseCount ?? 0) === 0;

  function toggle() {
    if (!expanded && !results) {
      startTransition(async () => {
        setResults(await getSurveyResults(survey.id));
      });
    }
    setExpanded((prev) => !prev);
  }

  function startEditing() {
    setEditError(null);
    startTransition(async () => {
      const result = await getSurveyForEditing(survey.id);
      if ("error" in result) {
        setEditError(result.error);
        return;
      }
      setEditingSurvey(result);
    });
  }

  if (editingSurvey) {
    return (
      <SurveyBuilder
        employees={[]}
        existingSurvey={editingSurvey}
        onSaved={() => {
          setEditingSurvey(null);
          setResults(null);
          router.refresh();
        }}
      />
    );
  }

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{survey.title}</p>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            {surveyThemeLabel(tThemes, survey.theme)} · {t("respondedCount", { responded: survey.responseCount ?? 0, assigned: survey.assignedCount })}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {canEdit && (
            <button
              type="button"
              onClick={startEditing}
              disabled={isPending}
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "var(--text)", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              {t("editSurvey")}
            </button>
          )}
          {results && "status" in results && results.status === "ready" && (
            <a
              href={`/api/company/export/surveys/${survey.id}/xlsx`}
              style={{
                background: "none",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: 12,
                color: "var(--text)",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              {t("exportExcel")}
            </a>
          )}
          <button
            type="button"
            onClick={toggle}
            style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "var(--teal)", cursor: "pointer" }}
          >
            {expanded ? t("hideResults") : t("viewResults")}
          </button>
        </div>
      </div>

      {editError && <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 10 }}>{editError}</p>}

      {expanded && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          {isPending && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("loading")}</p>}
          {results && "error" in results && <p style={{ fontSize: 12, color: "var(--danger)" }}>{results.error}</p>}
          {results && "status" in results && results.status === "insufficient_data" && (
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {t("insufficientData", { responded: results.responseCount, assigned: survey.assignedCount })}
            </p>
          )}
          {results && "status" in results && results.status === "ready" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {t("aggregatedAcross", { count: results.responseCount })}
              </p>
              {results.aggregates.map((a) => (
                <div key={a.questionId}>
                  <p style={{ fontSize: 13, color: "var(--text)", marginBottom: 6 }}>{a.text}</p>
                  {a.type === "rating" ? (
                    <p style={{ fontSize: 20, fontWeight: 800, color: "var(--teal)" }}>
                      {a.average}
                      <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-muted)" }}> {t("avgOutOf5", { count: a.count })}</span>
                    </p>
                  ) : a.type === "multiple_choice" ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {Object.entries(a.optionCounts).map(([option, count]) => (
                        <div key={option} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                          <span style={{ color: "var(--text-muted)" }}>{option}</span>
                          <span style={{ color: "var(--text)", fontWeight: 700 }}>{count}</span>
                        </div>
                      ))}
                    </div>
                  ) : a.count === 0 ? (
                    <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("noResponsesYet")}</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {a.responses.map((text, idx) => (
                        <p
                          key={idx}
                          style={{ fontSize: 12, color: "var(--text)", background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 10px", lineHeight: 1.5 }}
                        >
                          &ldquo;{text}&rdquo;
                        </p>
                      ))}
                      <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>
                        {t("randomOrderNote")}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
