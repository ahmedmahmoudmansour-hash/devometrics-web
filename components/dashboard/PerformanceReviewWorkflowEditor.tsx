"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ClipboardList, Target, Star, MessageSquare, FileText, Sparkles, ChevronUp, ChevronDown, X, Pencil } from "lucide-react";
import {
  addWorkflowStep,
  updateWorkflowStep,
  deleteWorkflowStep,
  moveWorkflowStep,
} from "@/lib/performanceReviews/workflowActions";
import { COMPETENCY_DIMENSIONS } from "@/lib/gap-analysis/dimensions";
import {
  defaultCompetencyRatingsConfig,
  defaultCustomStepConfig,
  type WorkflowStep,
  type StepType,
  type StepData,
  type CustomStepResponseShape,
  type CustomStepAssignmentMode,
} from "@/lib/performanceReviews/workflowTypes";

const CORE_TYPES: Exclude<StepType, "custom">[] = ["self_assessment", "goals", "competency_ratings", "manager_assessment", "conclusion"];

const STEP_ICON: Record<StepType, React.ComponentType<{ size?: number }>> = {
  self_assessment: FileText,
  goals: Target,
  competency_ratings: Star,
  manager_assessment: MessageSquare,
  conclusion: ClipboardList,
  custom: Sparkles,
};

// The CEO's own 8 examples — quick-picks, not a closed set ("Other…" stays
// free-typed, per "or freely typed beyond that list").
const CUSTOM_KIND_PRESETS: { key: string; defaults: Partial<ReturnType<typeof defaultCustomStepConfig>> }[] = [
  { key: "peer_feedback", defaults: { response_shape: "text", multi_respondent: true, min_respondents: 3, assignment: { mode: "manual" }, anonymize_to_employee: true } },
  { key: "360_feedback", defaults: { response_shape: "text", multi_respondent: true, min_respondents: 3, assignment: { mode: "manual" }, anonymize_to_employee: true } },
  { key: "skip_level_review", defaults: { response_shape: "approval", assignment: { mode: "role", role: "upline_manager_level_2" } } },
  { key: "calibration_meeting", defaults: { response_shape: "text", assignment: { mode: "role", role: "org_admin" } } },
  { key: "hr_review", defaults: { response_shape: "approval", assignment: { mode: "role", role: "org_admin" } } },
  { key: "promotion_committee", defaults: { response_shape: "approval", multi_respondent: true, assignment: { mode: "manual" } } },
  { key: "executive_approval", defaults: { response_shape: "approval", assignment: { mode: "manual" } } },
  { key: "country_approval", defaults: { response_shape: "approval", assignment: { mode: "manual" } } },
  { key: "other", defaults: {} },
];

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 13.5,
  color: "var(--text)",
  outline: "none",
};

const iconBtnStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--border)",
  borderRadius: 6,
  width: 26,
  height: 26,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--text-muted)",
  cursor: "pointer",
  flexShrink: 0,
};

type DraftConfig = {
  fixedDimensions: string[];
  organizationCompetencyIds: string[];
  customKindPreset: string;
  customKindFree: string;
  responseShape: CustomStepResponseShape;
  multiRespondent: boolean;
  minRespondents: string;
  assignmentMode: CustomStepAssignmentMode;
  assignmentRole: string;
};

function emptyDraft(): DraftConfig {
  return {
    fixedDimensions: [],
    organizationCompetencyIds: [],
    customKindPreset: "peer_feedback",
    customKindFree: "",
    responseShape: "text",
    multiRespondent: false,
    minRespondents: "",
    assignmentMode: "manual",
    assignmentRole: "direct_manager",
  };
}

function draftFromStepData(stepType: StepType, data: StepData): DraftConfig {
  const draft = emptyDraft();
  if (stepType === "competency_ratings") {
    draft.fixedDimensions = data.fixed_dimensions ?? [];
    draft.organizationCompetencyIds = data.organization_competency_ids ?? [];
  }
  if (stepType === "custom") {
    const kind = data.custom_kind ?? "";
    const isPreset = CUSTOM_KIND_PRESETS.some((p) => p.key === kind);
    draft.customKindPreset = isPreset ? kind : "other";
    draft.customKindFree = isPreset ? "" : kind;
    draft.responseShape = data.response_shape ?? "text";
    draft.multiRespondent = data.multi_respondent ?? false;
    draft.minRespondents = data.min_respondents != null ? String(data.min_respondents) : "";
    draft.assignmentMode = data.assignment?.mode ?? "manual";
    draft.assignmentRole = data.assignment?.role ?? "direct_manager";
  }
  return draft;
}

function buildStepData(stepType: StepType, draft: DraftConfig): StepData {
  if (stepType === "competency_ratings") {
    return { fixed_dimensions: draft.fixedDimensions, organization_competency_ids: draft.organizationCompetencyIds };
  }
  if (stepType === "custom") {
    const customKind = draft.customKindPreset === "other" ? draft.customKindFree.trim() : draft.customKindPreset;
    return {
      ...defaultCustomStepConfig(customKind),
      response_shape: draft.responseShape,
      multi_respondent: draft.multiRespondent,
      min_respondents: draft.minRespondents ? Number(draft.minRespondents) : null,
      assignment: draft.assignmentMode === "role" ? { mode: "role", role: draft.assignmentRole as never } : { mode: "manual" },
    };
  }
  return {};
}

function ConfigFields({
  stepType,
  draft,
  onChange,
  organizationCompetencyOptions,
  t,
  tKinds,
}: {
  stepType: StepType;
  draft: DraftConfig;
  onChange: (next: DraftConfig) => void;
  organizationCompetencyOptions: { id: string; name: string }[];
  t: (key: string, values?: Record<string, string | number>) => string;
  tKinds: (key: string) => string;
}) {
  if (stepType === "competency_ratings") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t("competencyPoolHint")}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {COMPETENCY_DIMENSIONS.map((dim) => {
            const active = draft.fixedDimensions.includes(dim);
            return (
              <button
                key={dim}
                type="button"
                onClick={() =>
                  onChange({
                    ...draft,
                    fixedDimensions: active ? draft.fixedDimensions.filter((d) => d !== dim) : [...draft.fixedDimensions, dim],
                  })
                }
                style={{
                  padding: "5px 10px",
                  fontSize: 11.5,
                  fontWeight: 600,
                  borderRadius: 999,
                  border: active ? "1px solid var(--teal)" : "1px solid var(--border)",
                  background: active ? "rgba(var(--teal-rgb),0.1)" : "transparent",
                  color: active ? "var(--teal)" : "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                {dim}
              </button>
            );
          })}
        </div>
        {organizationCompetencyOptions.length > 0 && (
          <>
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>{t("orgCompetenciesHint")}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {organizationCompetencyOptions.map((c) => {
                const active = draft.organizationCompetencyIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...draft,
                        organizationCompetencyIds: active
                          ? draft.organizationCompetencyIds.filter((id) => id !== c.id)
                          : [...draft.organizationCompetencyIds, c.id],
                      })
                    }
                    style={{
                      padding: "5px 10px",
                      fontSize: 11.5,
                      fontWeight: 600,
                      borderRadius: 999,
                      border: active ? "1px solid var(--teal)" : "1px solid var(--border)",
                      background: active ? "rgba(var(--teal-rgb),0.1)" : "transparent",
                      color: active ? "var(--teal)" : "var(--text-muted)",
                      cursor: "pointer",
                    }}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  if (stepType === "custom") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <select value={draft.customKindPreset} onChange={(e) => onChange({ ...draft, customKindPreset: e.target.value })} style={inputStyle}>
          {CUSTOM_KIND_PRESETS.map((p) => (
            <option key={p.key} value={p.key}>
              {tKinds(p.key)}
            </option>
          ))}
        </select>
        {draft.customKindPreset === "other" && (
          <input value={draft.customKindFree} onChange={(e) => onChange({ ...draft, customKindFree: e.target.value })} placeholder={t("customKindPlaceholder")} style={inputStyle} />
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)", flex: 1 }}>
            {t("responseShapeLabel")}
            <select value={draft.responseShape} onChange={(e) => onChange({ ...draft, responseShape: e.target.value as CustomStepResponseShape })} style={{ ...inputStyle, marginTop: 4 }}>
              <option value="approval">{t("shapeApproval")}</option>
              <option value="rating">{t("shapeRating")}</option>
              <option value="text">{t("shapeText")}</option>
            </select>
          </label>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text)", cursor: "pointer" }}>
          <input type="checkbox" checked={draft.multiRespondent} onChange={(e) => onChange({ ...draft, multiRespondent: e.target.checked })} />
          {t("multiRespondentLabel")}
        </label>
        {draft.multiRespondent && (
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {t("minRespondentsLabel")}
            <input type="number" min={1} value={draft.minRespondents} onChange={(e) => onChange({ ...draft, minRespondents: e.target.value })} style={{ ...inputStyle, marginTop: 4, width: 80 }} />
          </label>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <select value={draft.assignmentMode} onChange={(e) => onChange({ ...draft, assignmentMode: e.target.value as CustomStepAssignmentMode })} style={{ ...inputStyle, flex: 1 }}>
            <option value="manual">{t("assignManually")}</option>
            <option value="role">{t("assignByRole")}</option>
          </select>
          {draft.assignmentMode === "role" && (
            <select value={draft.assignmentRole} onChange={(e) => onChange({ ...draft, assignmentRole: e.target.value })} style={{ ...inputStyle, flex: 1 }}>
              <option value="direct_manager">{t("roleDirectManager")}</option>
              <option value="org_admin">{t("roleOrgAdmin")}</option>
              <option value="upline_manager_level_2">{t("roleUplineLevel2")}</option>
            </select>
          )}
        </div>
      </div>
    );
  }

  return null;
}

export default function PerformanceReviewWorkflowEditor({
  templateId,
  initialSteps,
  organizationCompetencyOptions,
}: {
  templateId: string;
  initialSteps: WorkflowStep[];
  organizationCompetencyOptions: { id: string; name: string }[];
}) {
  const t = useTranslations("performanceReviewWorkflowEditor");
  const tKinds = useTranslations("customStepKinds");
  const [steps, setSteps] = useState(initialSteps);
  const [stepType, setStepType] = useState<StepType>("goals");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [draft, setDraft] = useState<DraftConfig>(emptyDraft());
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetForm() {
    setStepType("goals");
    setTitle("");
    setDescription("");
    setDraft(stepType === "competency_ratings" ? draftFromStepData("competency_ratings", defaultCompetencyRatingsConfig()) : emptyDraft());
  }

  function handleAdd() {
    setError(null);
    if (!title.trim()) {
      setError(t("titleRequired"));
      return;
    }
    const data = buildStepData(stepType, draft);
    startTransition(async () => {
      const result = await addWorkflowStep(templateId, { stepType, title, description, data });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSteps((prev) => [
        ...prev,
        {
          id: `temp-${Date.now()}`,
          template_id: templateId,
          position: prev.length,
          step_type: stepType,
          title: title.trim(),
          description: description.trim() || null,
          data,
          created_at: new Date().toISOString(),
        },
      ]);
      resetForm();
    });
  }

  function handleDelete(stepId: string) {
    startTransition(async () => {
      await deleteWorkflowStep(stepId);
      setSteps((prev) => prev.filter((s) => s.id !== stepId));
    });
  }

  function handleMove(stepId: string, direction: "up" | "down") {
    const index = steps.findIndex((s) => s.id === stepId);
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || swapWith < 0 || swapWith >= steps.length) return;
    const next = [...steps];
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
    setSteps(next);
    startTransition(async () => {
      await moveWorkflowStep(templateId, stepId, direction);
    });
  }

  function startEdit(step: WorkflowStep) {
    setEditingStepId(step.id);
    setTitle(step.title);
    setDescription(step.description ?? "");
    setDraft(draftFromStepData(step.step_type, step.data));
  }

  function saveEdit(step: WorkflowStep) {
    const data = buildStepData(step.step_type, draft);
    startTransition(async () => {
      await updateWorkflowStep(step.id, { title, description, data });
      setSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, title: title.trim(), description: description.trim() || null, data } : s)));
      setEditingStepId(null);
    });
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{t("title")}</h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>{t("description")}</p>

      {steps.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>{t("noSteps")}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          {steps.map((step, i) => {
            const Icon = STEP_ICON[step.step_type];
            const isEditing = editingStepId === step.id;
            return (
              <div key={step.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Icon size={15} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{step.title}</p>
                    <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                      {step.step_type === "custom" ? tKinds(step.data.custom_kind || "other") : t(`type_${step.step_type}`)}
                    </p>
                  </div>
                  <button type="button" onClick={() => (isEditing ? setEditingStepId(null) : startEdit(step))} disabled={isPending} style={iconBtnStyle}>
                    <Pencil size={13} />
                  </button>
                  <button type="button" onClick={() => handleMove(step.id, "up")} disabled={i === 0 || isPending} style={iconBtnStyle}>
                    <ChevronUp size={14} />
                  </button>
                  <button type="button" onClick={() => handleMove(step.id, "down")} disabled={i === steps.length - 1 || isPending} style={iconBtnStyle}>
                    <ChevronDown size={14} />
                  </button>
                  <button type="button" onClick={() => handleDelete(step.id)} disabled={isPending} style={{ ...iconBtnStyle, color: "var(--amber)" }}>
                    <X size={14} />
                  </button>
                </div>

                {isEditing && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} style={inputStyle} />
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
                    <ConfigFields stepType={step.step_type} draft={draft} onChange={setDraft} organizationCompetencyOptions={organizationCompetencyOptions} t={t} tKinds={tKinds} />
                    <button
                      type="button"
                      onClick={() => saveEdit(step)}
                      disabled={isPending}
                      style={{ alignSelf: "flex-start", background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
                    >
                      {t("saveStep")}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{t("addStepTitle")}</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[...CORE_TYPES, "custom" as const].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                setStepType(type);
                setDraft(type === "competency_ratings" ? draftFromStepData("competency_ratings", defaultCompetencyRatingsConfig()) : emptyDraft());
              }}
              style={{
                padding: "7px 12px",
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 999,
                border: type === stepType ? "1px solid var(--teal)" : "1px solid var(--border)",
                background: type === stepType ? "rgba(var(--teal-rgb),0.1)" : "transparent",
                color: type === stepType ? "var(--teal)" : "var(--text-muted)",
                cursor: "pointer",
              }}
            >
              {type === "custom" ? t("addCustomStep") : t(`type_${type}`)}
            </button>
          ))}
        </div>

        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("titlePlaceholder")} maxLength={200} style={inputStyle} />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("descriptionPlaceholder")}
          maxLength={1000}
          rows={2}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
        />

        <ConfigFields stepType={stepType} draft={draft} onChange={setDraft} organizationCompetencyOptions={organizationCompetencyOptions} t={t} tKinds={tKinds} />

        {error && <p style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</p>}

        <button
          type="button"
          onClick={handleAdd}
          disabled={isPending}
          style={{
            alignSelf: "flex-start",
            background: "var(--teal)",
            color: "#0A0F1E",
            border: "none",
            borderRadius: 8,
            padding: "9px 18px",
            fontSize: 13.5,
            fontWeight: 700,
            cursor: "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {t("addStep")}
        </button>
      </div>
    </div>
  );
}
