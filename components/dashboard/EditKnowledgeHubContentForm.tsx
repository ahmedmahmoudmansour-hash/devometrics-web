"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  updateKnowledgeHubContent,
  archiveKnowledgeHubContent,
  unarchiveKnowledgeHubContent,
  deleteKnowledgeHubContent,
  listKnowledgeHubContentVersions,
  type KnowledgeHubContentVersion,
} from "@/lib/knowledgeHub/actions";
import type { KnowledgeHubContent } from "@/lib/supabase/types";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 14,
  color: "var(--text)",
  outline: "none",
};

export default function EditKnowledgeHubContentForm({ content }: { content: KnowledgeHubContent }) {
  const t = useTranslations("editKnowledgeHubContentForm");
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState(content.title);
  const [description, setDescription] = useState(content.description ?? "");
  const [passingScore, setPassingScore] = useState(content.passing_score_percent);
  const [maxAttempts, setMaxAttempts] = useState<string>(content.max_attempts?.toString() ?? "");
  const [dueDate, setDueDate] = useState(content.due_date ?? "");
  const [isNewHireContent, setIsNewHireContent] = useState(content.is_new_hire_content);
  const [notifyLearners, setNotifyLearners] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [versions, setVersions] = useState<KnowledgeHubContentVersion[] | null>(null);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const router = useRouter();

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateKnowledgeHubContent(
        content.id,
        {
          title,
          description,
          passingScorePercent: passingScore,
          maxAttempts: maxAttempts.trim() ? Number(maxAttempts) : null,
          dueDate: dueDate || null,
          isNewHireContent,
        },
        notifyLearners
      );
      if (result?.error) {
        setError(result.error);
        return;
      }
      setExpanded(false);
      setVersions(null);
      router.refresh();
    });
  }

  function archive() {
    setError(null);
    startTransition(async () => {
      const result = await archiveKnowledgeHubContent(content.id);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.push("/dashboard/company/knowledge-hub");
    });
  }

  function unarchive() {
    setError(null);
    startTransition(async () => {
      const result = await unarchiveKnowledgeHubContent(content.id);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await deleteKnowledgeHubContent(content.id);
      if ("error" in result) {
        setError(result.error);
        setConfirmingDelete(false);
        return;
      }
      router.push("/dashboard/company/knowledge-hub");
    });
  }

  function toggleVersions() {
    if (versions !== null) {
      setVersions(null);
      return;
    }
    setLoadingVersions(true);
    listKnowledgeHubContentVersions(content.id)
      .then(setVersions)
      .finally(() => setLoadingVersions(false));
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "8px 16px",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text)",
          cursor: "pointer",
        }}
      >
        {t("edit")}
      </button>
    );
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 480 }}>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("titlePlaceholder")} style={inputStyle} />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("descriptionPlaceholder")}
          rows={2}
          style={{ ...inputStyle, resize: "vertical" }}
        />
        <div style={{ display: "flex", gap: 12 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 6 }}>
            {t("dueDateLabel")}
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{ ...inputStyle, colorScheme: "dark" }}
            />
          </label>
          {content.completion_type === "exam" && (
            <label style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 6 }}>
              {t("passingScoreLabel")}
              <input
                type="number"
                min={1}
                max={100}
                value={passingScore}
                onChange={(e) => setPassingScore(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
                style={inputStyle}
              />
            </label>
          )}
          {content.completion_type === "exam" && (
            <label style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 6 }}>
              {t("maxAttemptsLabel")}
              <input
                type="number"
                min={1}
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(e.target.value)}
                placeholder={t("unlimitedPlaceholder")}
                style={inputStyle}
              />
            </label>
          )}
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}>
          <input type="checkbox" checked={notifyLearners} onChange={(e) => setNotifyLearners(e.target.checked)} />
          {t("notifyLearnersLabel")}
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}>
          <input type="checkbox" checked={isNewHireContent} onChange={(e) => setIsNewHireContent(e.target.checked)} />
          {t("newHireContentLabel")}
        </label>

        {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {content.archived_at ? (
              <button
                type="button"
                onClick={unarchive}
                disabled={isPending}
                style={{ background: "transparent", border: "1px solid rgba(var(--teal-rgb),0.4)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "var(--teal)", cursor: "pointer" }}
              >
                {isPending ? t("restoring") : t("restoreButton")}
              </button>
            ) : confirmingArchive ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("archiveThisContentQuestion")}</span>
                <button
                  type="button"
                  onClick={archive}
                  disabled={isPending}
                  style={{ background: "rgba(var(--danger-rgb),0.12)", border: "1px solid rgba(var(--danger-rgb),0.4)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, color: "var(--danger)", cursor: "pointer" }}
                >
                  {isPending ? t("archiving") : t("yesArchive")}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingArchive(false)}
                  style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}
                >
                  {t("cancel")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingArchive(true)}
                style={{ background: "transparent", border: "1px solid rgba(var(--danger-rgb),0.4)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "var(--danger)", cursor: "pointer" }}
              >
                {t("archiveThisContentButton")}
              </button>
            )}

            {confirmingDelete ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("deleteThisContentQuestion")}</span>
                <button
                  type="button"
                  onClick={remove}
                  disabled={isPending}
                  style={{ background: "rgba(var(--danger-rgb),0.2)", border: "1px solid var(--danger)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, color: "var(--danger)", cursor: "pointer" }}
                >
                  {isPending ? t("deleting") : t("yesDelete")}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}
                >
                  {t("cancel")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                style={{ background: "transparent", border: "1px solid var(--danger)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "var(--danger)", cursor: "pointer" }}
              >
                {t("deleteThisContentButton")}
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              disabled={isPending}
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "var(--text-muted)", cursor: "pointer" }}
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}
            >
              {isPending ? t("saving") : t("save")}
            </button>
          </div>
        </div>
        <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>{t("archiveNote")}</p>
        <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>{t("deleteNote")}</p>

        <div>
          <button
            type="button"
            onClick={toggleVersions}
            style={{ background: "none", border: "none", color: "var(--teal)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}
          >
            {versions !== null ? t("hideHistory") : t("showHistory")}
          </button>
          {loadingVersions && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>{t("loadingHistory")}</p>}
          {versions !== null && !loadingVersions && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {versions.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("noHistory")}</p>
              ) : (
                versions.map((v) => (
                  <div key={v.id} style={{ fontSize: 12, color: "var(--text-muted)", borderLeft: "2px solid var(--border)", paddingLeft: 10 }}>
                    <div style={{ color: "var(--text)", fontWeight: 600 }}>{v.title}</div>
                    <div>
                      {t("versionMeta", {
                        date: new Date(v.editedAt).toLocaleString(),
                        editor: v.editedByName ?? t("unknownEditor"),
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
