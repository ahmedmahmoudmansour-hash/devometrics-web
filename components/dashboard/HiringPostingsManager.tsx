"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createJobPosting, suggestPostingRequirements, saveJobPostingRequirements, setJobPostingStatus, deleteJobPosting } from "@/lib/hiring/postingActions";
import { COMPETENCY_DIMENSIONS, dimensionLabel } from "@/lib/gap-analysis/dimensions";
import type { RoleGradingSuggestion } from "@/lib/jobArchitecture/actions";
import { postingStatusLabel } from "@/lib/hiring/types";
import type { JobPosting, JobPostingStatus } from "@/lib/hiring/types";
import type { LinkableJobRole } from "@/lib/hiring/aggregate";

const card: React.CSSProperties = {
  background: "var(--navy-mid)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  padding: 22,
};

const input: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 13,
  color: "var(--text)",
  outline: "none",
};

const primaryBtn: React.CSSProperties = {
  background: "var(--teal)",
  color: "#0A0F1E",
  border: "none",
  borderRadius: 8,
  padding: "9px 16px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "9px 14px",
  fontSize: 13,
  color: "var(--text-muted)",
  cursor: "pointer",
};

const STATUS_COLOR: Record<JobPostingStatus, string> = {
  draft: "var(--text-muted)",
  open: "var(--teal)",
  closed: "#f87171",
};

type PostingRow = JobPosting & { candidateCount: number; hiredCount: number };

export default function HiringPostingsManager({ postings, linkableRoles }: { postings: PostingRow[]; linkableRoles: LinkableJobRole[] }) {
  const t = useTranslations("hiringPostingsManager");
  const tStatus = useTranslations("postingStatus");
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [isPending, startTransition] = useTransition();

  function refresh() {
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {showAdd ? (
        <NewPostingForm
          linkableRoles={linkableRoles}
          onDone={() => {
            setShowAdd(false);
            refresh();
          }}
          onCancel={() => setShowAdd(false)}
        />
      ) : (
        <button type="button" style={{ ...primaryBtn, alignSelf: "flex-start" }} onClick={() => setShowAdd(true)}>
          {t("newJobPosting")}
        </button>
      )}

      {postings.length === 0 && !showAdd && (
        <div style={card}>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
            {t("noPostingsYet")}
          </p>
        </div>
      )}

      {postings.map((posting) => (
        <div key={posting.id} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Link href={`/dashboard/company/hiring/${posting.id}`} style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", textDecoration: "none" }}>
                  {posting.title}
                </Link>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: STATUS_COLOR[posting.status],
                    border: `1px solid ${STATUS_COLOR[posting.status]}`,
                    borderRadius: 999,
                    padding: "2px 8px",
                  }}
                >
                  {postingStatusLabel(tStatus, posting.status)}
                </span>
              </div>
              {posting.department && <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>{posting.department}</p>}
              {posting.linked_role_id && (
                <p style={{ fontSize: 11, color: "var(--teal)", marginTop: 4 }}>
                  {t("linkedToRole", {
                    role: linkableRoles.find((r) => r.id === posting.linked_role_id)?.title ?? t("jobArchitectureRoleFallback"),
                  })}
                </p>
              )}
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
                {t("candidateCount", { count: posting.candidateCount })}
                {posting.hiredCount > 0 ? t("hiredSuffix", { count: posting.hiredCount }) : ""}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select
                value={posting.status}
                style={{ ...input, width: 110, cursor: "pointer" }}
                onChange={(e) =>
                  startTransition(async () => {
                    await setJobPostingStatus(posting.id, e.target.value as JobPostingStatus);
                    refresh();
                  })
                }
              >
                <option value="draft">{tStatus("draft")}</option>
                <option value="open">{tStatus("open")}</option>
                <option value="closed">{tStatus("closed")}</option>
              </select>
              <Link href={`/dashboard/company/hiring/${posting.id}`} style={{ ...ghostBtn, textDecoration: "none", display: "inline-block" }}>
                {t("openPipeline")}
              </Link>
              <button
                type="button"
                disabled={isPending}
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}
                onClick={() =>
                  startTransition(async () => {
                    if (!confirm(t("deleteConfirm", { title: posting.title }))) return;
                    await deleteJobPosting(posting.id);
                    refresh();
                  })
                }
              >
                {t("delete")}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function NewPostingForm({
  linkableRoles,
  onDone,
  onCancel,
}: {
  linkableRoles: LinkableJobRole[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("hiringPostingsManager");
  const tDim = useTranslations("competencyDimensions");
  const [isPending, startTransition] = useTransition();
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [responsibilities, setResponsibilities] = useState("");
  const [rationale, setRationale] = useState("");
  const [reqs, setReqs] = useState<Record<string, number>>({});
  const [linkedRoleId, setLinkedRoleId] = useState<string>("");

  function applySuggestion(s: RoleGradingSuggestion) {
    setRationale(s.rationale);
    const next: Record<string, number> = {};
    for (const r of s.competencyRequirements) next[r.dimension] = r.targetLevel;
    setReqs(next);
  }

  // Carries over what Job Architecture already has for this role — the JD
  // (if one was generated there) or a plain fallback built from its
  // responsibilities, plus its required competency levels — instead of
  // making the admin re-write a JD that already exists.
  function applyLinkedRole(roleId: string) {
    setLinkedRoleId(roleId);
    if (!roleId) return;
    const role = linkableRoles.find((r) => r.id === roleId);
    if (!role) return;
    if (!title.trim()) setTitle(role.title);
    if (role.generatedJd) setJobDescription(role.generatedJd);
    if (role.responsibilities) setResponsibilities(role.responsibilities);
    if (role.requirements.length > 0) {
      const next: Record<string, number> = {};
      for (const r of role.requirements) next[r.dimension] = r.targetLevel;
      setReqs(next);
    }
  }

  return (
    <div style={{ ...card, border: "1px solid rgba(0,201,167,0.3)", background: "rgba(0,201,167,0.03)" }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>{t("newPostingTitle")}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {linkableRoles.length > 0 && (
          <label style={{ fontSize: 11.5, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
            {t("linkExistingRole")}
            <select style={{ ...input, cursor: "pointer" }} value={linkedRoleId} onChange={(e) => applyLinkedRole(e.target.value)}>
              <option value="">{t("noneStartFromScratch")}</option>
              {linkableRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                  {r.level ? ` (${r.level})` : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <input style={input} placeholder={t("jobTitlePlaceholder")} value={title} onChange={(e) => setTitle(e.target.value)} />
        <input style={input} placeholder={t("departmentPlaceholder")} value={department} onChange={(e) => setDepartment(e.target.value)} />
        <textarea
          style={{ ...input, resize: "vertical" }}
          rows={4}
          placeholder={t("jobDescriptionPlaceholder")}
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
        />
        <textarea
          style={{ ...input, resize: "vertical" }}
          rows={3}
          placeholder={t("responsibilitiesPlaceholder")}
          value={responsibilities}
          onChange={(e) => setResponsibilities(e.target.value)}
        />

        <button
          type="button"
          disabled={suggesting || !title.trim()}
          style={{ ...ghostBtn, alignSelf: "flex-start", color: "var(--teal)", borderColor: "rgba(0,201,167,0.4)", opacity: suggesting || !title.trim() ? 0.5 : 1 }}
          onClick={() => {
            setSuggesting(true);
            setError(null);
            startTransition(async () => {
              const result = await suggestPostingRequirements(title, responsibilities);
              setSuggesting(false);
              if ("error" in result) setError(result.error);
              else applySuggestion(result.suggestion);
            });
          }}
        >
          {suggesting ? t("analyzing") : t("suggestRequirements")}
        </button>

        {rationale && (
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5, fontStyle: "italic", borderLeft: "2px solid var(--teal)", paddingLeft: 10 }}>
            {rationale}
          </p>
        )}

        {Object.keys(reqs).length > 0 && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              {t("requiredCompetencyLevels")}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 8 }}>
              {COMPETENCY_DIMENSIONS.map((dim) => (
                <div key={dim} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 11.5, color: "var(--text-muted)" }}>{dimensionLabel(tDim, dim)}</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    style={{ ...input, width: 70 }}
                    value={reqs[dim] ?? 0}
                    onChange={(e) => setReqs((prev) => ({ ...prev, [dim]: Number(e.target.value) }))}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p style={{ color: "#f87171", fontSize: 12 }}>{error}</p>}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            disabled={isPending || !title.trim()}
            style={{ ...primaryBtn, opacity: isPending || !title.trim() ? 0.5 : 1 }}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const created = await createJobPosting({ title, department, jobDescription, responsibilities, linkedRoleId: linkedRoleId || null });
                if (created.error || !created.postingId) {
                  setError(created.error ?? t("couldNotCreatePosting"));
                  return;
                }
                const requirements = COMPETENCY_DIMENSIONS.map((dim) => ({ dimension: dim, targetLevel: reqs[dim] ?? 0 })).filter(
                  (r) => r.targetLevel > 0
                );
                if (requirements.length) await saveJobPostingRequirements(created.postingId, requirements);
                onDone();
              })
            }
          >
            {isPending ? t("creating") : t("createPosting")}
          </button>
          <button type="button" style={ghostBtn} onClick={onCancel}>
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
