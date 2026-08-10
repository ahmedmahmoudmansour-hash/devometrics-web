"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ListChecks, Library, UserCheck, ChevronUp, ChevronDown, X, Pencil } from "lucide-react";
import {
  addOnboardingTemplateStep,
  updateOnboardingTemplateStep,
  deleteOnboardingTemplateStep,
  moveOnboardingTemplateStep,
} from "@/lib/onboarding/actions";
import type { OnboardingTemplateStep, OnboardingStepType } from "@/lib/onboarding/types";

const STEP_ICON: Record<OnboardingStepType, React.ComponentType<{ size?: number }>> = {
  task: ListChecks,
  knowledge_hub: Library,
  manager_approval: UserCheck,
};

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

export default function OnboardingTemplateEditor({
  templateId,
  initialSteps,
  knowledgeHubOptions,
}: {
  templateId: string;
  initialSteps: OnboardingTemplateStep[];
  knowledgeHubOptions: { id: string; title: string }[];
}) {
  const t = useTranslations("onboardingTemplateEditor");
  const [steps, setSteps] = useState(initialSteps);
  const [stepType, setStepType] = useState<OnboardingStepType>("task");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [knowledgeHubContentId, setKnowledgeHubContentId] = useState("");
  const [dueOffsetDays, setDueOffsetDays] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editKnowledgeHubContentId, setEditKnowledgeHubContentId] = useState("");
  const [editDueOffsetDays, setEditDueOffsetDays] = useState(0);
  const [editError, setEditError] = useState<string | null>(null);

  function resetForm() {
    setStepType("task");
    setTitle("");
    setDescription("");
    setKnowledgeHubContentId("");
    setDueOffsetDays(0);
  }

  function handleAdd() {
    setError(null);
    if (!title.trim()) {
      setError(t("titleRequired"));
      return;
    }
    startTransition(async () => {
      const result = await addOnboardingTemplateStep(templateId, {
        stepType,
        title,
        description,
        knowledgeHubContentId: knowledgeHubContentId || null,
        dueOffsetDays,
      });
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
          knowledge_hub_content_id: stepType === "knowledge_hub" ? knowledgeHubContentId || null : null,
          due_offset_days: dueOffsetDays,
        },
      ]);
      resetForm();
    });
  }

  function handleDelete(stepId: string) {
    startTransition(async () => {
      await deleteOnboardingTemplateStep(stepId);
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
      await moveOnboardingTemplateStep(templateId, stepId, direction);
    });
  }

  function startEdit(step: OnboardingTemplateStep) {
    setEditingStepId(step.id);
    setEditTitle(step.title);
    setEditDescription(step.description ?? "");
    setEditKnowledgeHubContentId(step.knowledge_hub_content_id ?? "");
    setEditDueOffsetDays(step.due_offset_days);
    setEditError(null);
  }

  function cancelEdit() {
    setEditingStepId(null);
    setEditError(null);
  }

  function saveEdit(stepId: string) {
    setEditError(null);
    if (!editTitle.trim()) {
      setEditError(t("titleRequired"));
      return;
    }
    startTransition(async () => {
      const result = await updateOnboardingTemplateStep(stepId, {
        title: editTitle,
        description: editDescription,
        knowledgeHubContentId: editKnowledgeHubContentId || null,
        dueOffsetDays: editDueOffsetDays,
      });
      if (result?.error) {
        setEditError(result.error);
        return;
      }
      setSteps((prev) =>
        prev.map((s) =>
          s.id === stepId
            ? {
                ...s,
                title: editTitle.trim(),
                description: editDescription.trim() || null,
                knowledge_hub_content_id: s.step_type === "knowledge_hub" ? editKnowledgeHubContentId || null : null,
                due_offset_days: editDueOffsetDays,
              }
            : s
        )
      );
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
            if (editingStepId === step.id) {
              return (
                <div key={step.id} style={{ display: "flex", flexDirection: "column", gap: 8, border: "1px solid var(--teal)", borderRadius: 10, padding: 12 }}>
                  <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder={t("titlePlaceholder")} maxLength={200} style={inputStyle} />
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder={t("descriptionPlaceholder")}
                    maxLength={1000}
                    rows={2}
                    style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
                  />
                  {step.step_type === "knowledge_hub" && (
                    <select value={editKnowledgeHubContentId} onChange={(e) => setEditKnowledgeHubContentId(e.target.value)} style={inputStyle}>
                      <option value="">{t("chooseDocument")}</option>
                      {knowledgeHubOptions.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.title}
                        </option>
                      ))}
                    </select>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{t("dueOffsetLabel")}</label>
                    <input
                      type="number"
                      min={0}
                      max={180}
                      value={editDueOffsetDays}
                      onChange={(e) => setEditDueOffsetDays(Number(e.target.value))}
                      style={{ ...inputStyle, width: 80 }}
                    />
                  </div>
                  {editError && <p style={{ color: "#f87171", fontSize: 12.5 }}>{editError}</p>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => saveEdit(step.id)}
                      disabled={isPending}
                      style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}
                    >
                      {t("saveStep")}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={isPending}
                      style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 600, color: "var(--text-muted)", cursor: "pointer" }}
                    >
                      {t("cancelEdit")}
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
                <Icon size={15} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{step.title}</p>
                  <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                    {t(`type_${step.step_type}`)} · {t("dueOffset", { days: step.due_offset_days })}
                  </p>
                </div>
                <button type="button" onClick={() => startEdit(step)} disabled={isPending} style={iconBtnStyle}>
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
            );
          })}
        </div>
      )}

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{t("addStepTitle")}</p>
        <div style={{ display: "flex", gap: 6 }}>
          {(["task", "knowledge_hub", "manager_approval"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setStepType(type)}
              style={{
                padding: "7px 12px",
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 999,
                border: type === stepType ? "1px solid var(--teal)" : "1px solid var(--border)",
                background: type === stepType ? "rgba(0,201,167,0.1)" : "transparent",
                color: type === stepType ? "var(--teal)" : "var(--text-muted)",
                cursor: "pointer",
              }}
            >
              {t(`type_${type}`)}
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

        {stepType === "knowledge_hub" && (
          <select value={knowledgeHubContentId} onChange={(e) => setKnowledgeHubContentId(e.target.value)} style={inputStyle}>
            <option value="">{t("chooseDocument")}</option>
            {knowledgeHubOptions.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.title}
              </option>
            ))}
          </select>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{t("dueOffsetLabel")}</label>
          <input
            type="number"
            min={0}
            max={180}
            value={dueOffsetDays}
            onChange={(e) => setDueOffsetDays(Number(e.target.value))}
            style={{ ...inputStyle, width: 80 }}
          />
        </div>

        {error && <p style={{ color: "#f87171", fontSize: 12.5 }}>{error}</p>}

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
