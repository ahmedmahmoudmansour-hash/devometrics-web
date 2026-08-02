"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export const OPEN_PALETTE_EVENT = "devometrics:open-palette";

type Entry = {
  labelKey: string;
  href: string;
  hintKey?: string;
  keywords: string;
};

// Everything reachable in two keystrokes: Ctrl+K, type, Enter. The list is
// static and instant on purpose — no fetch, no spinner, no index to build.
// Keywords stay fixed English (the underlying fuzzy-match index), matching
// the same stable-identifier pattern as stageLabel/dimensionLabel — only the
// displayed labelKey/hintKey are translated.
function buildEntries(
  isCompanyAdmin: boolean,
  isPlatformAdmin: boolean,
  hasDirectReports: boolean,
  hasManager: boolean,
  hasOrgMembership: boolean
): Entry[] {
  const entries: Entry[] = [
    { labelKey: "progress", href: "/dashboard", keywords: "home overview dashboard start" },
    { labelKey: "aiCoach", href: "/dashboard/coach", hintKey: "aiCoachHint", keywords: "chat talk mentor advice session" },
    { labelKey: "bookCoaching", href: "/dashboard/coach/book", hintKey: "bookCoachingHint", keywords: "schedule appointment calendar reminder book" },
    { labelKey: "gapAnalysis", href: "/dashboard/gap-analysis", hintKey: "gapAnalysisHint", keywords: "cv resume job description competency gap" },
    { labelKey: "assessments", href: "/dashboard/assessments", keywords: "test quiz evaluate skills big five personality" },
    { labelKey: "practiceScenarios", href: "/dashboard/roleplay", hintKey: "practiceScenariosHint", keywords: "roleplay interview practice negotiation feedback" },
    { labelKey: "careerPaths", href: "/dashboard/career-paths", hintKey: "careerPathsHint", keywords: "map future promotion readiness next role" },
    { labelKey: "tasksCalendar", href: "/dashboard/tasks", keywords: "todo task calendar day week plan sync outlook google" },
    { labelKey: "workspace", href: "/dashboard/notes", hintKey: "workspaceHint", keywords: "notes ideas write second brain action items" },
    { labelKey: "accountabilityGroups", href: "/dashboard/accountability", hintKey: "accountabilityGroupsHint", keywords: "accountability study group peer partner checkin progress" },
    { labelKey: "discovery", href: "/dashboard/discovery", hintKey: "discoveryHint", keywords: "interview questions profile onboarding" },
    { labelKey: "resumeIntelligence", href: "/dashboard/resume", keywords: "cv ats score keywords bullets" },
    { labelKey: "scorecard", href: "/dashboard/scorecard", keywords: "score career health momentum badges" },
    { labelKey: "myDevelopment", href: "/dashboard/plans", hintKey: "myDevelopmentHint", keywords: "plans milestones status in progress completed deferred track" },
    { labelKey: "myJourney", href: "/dashboard/journey", hintKey: "myJourneyHint", keywords: "history timeline progress log" },
    { labelKey: "profile", href: "/dashboard/profile", keywords: "account avatar settings preferences experience education" },
  ];
  if (hasManager) {
    entries.push({ labelKey: "impactCycle", href: "/dashboard/impact-cycle", hintKey: "impactCycleHint", keywords: "performance review appraisal rating goals focus areas cycle confirm feedback impact" });
  }
  if (hasOrgMembership) {
    entries.push({ labelKey: "knowledgeHub", href: "/dashboard/knowledge-hub", hintKey: "knowledgeHubHint", keywords: "training document exam attestation library course learning assigned" });
  }
  if (hasDirectReports) {
    entries.push({ labelKey: "myTeam", href: "/dashboard/my-team", hintKey: "myTeamHint", keywords: "team manager reports review appraisal perspective" });
  }
  if (isCompanyAdmin) {
    entries.push(
      { labelKey: "company", href: "/dashboard/company", keywords: "organization workspace admin hr" },
      { labelKey: "employees", href: "/dashboard/company/employees", hintKey: "employeesHint", keywords: "team workforce heatmap staff hr edit archive" },
      { labelKey: "impactCyclesAdmin", href: "/dashboard/company/impact-cycles", hintKey: "impactCyclesAdminHint", keywords: "performance review cycle appraisal manager assessment goals impact" },
      { labelKey: "knowledgeHubAdmin", href: "/dashboard/company/knowledge-hub", hintKey: "knowledgeHubAdminHint", keywords: "training document exam attestation library course upload assign lms" }
    );
  }
  if (isPlatformAdmin) {
    entries.push(
      { labelKey: "admin", href: "/dashboard/admin", keywords: "platform pilot tracking" },
      { labelKey: "contactInquiries", href: "/dashboard/admin/inquiries", hintKey: "contactInquiriesHint", keywords: "contact form messages sales support careers inbox" }
    );
  }
  return entries;
}

export default function CommandPalette({
  isCompanyAdmin,
  isPlatformAdmin,
  hasDirectReports,
  hasManager,
  hasOrgMembership,
}: {
  isCompanyAdmin: boolean;
  isPlatformAdmin: boolean;
  hasDirectReports: boolean;
  hasManager: boolean;
  hasOrgMembership: boolean;
}) {
  const t = useTranslations("commandPalette");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const entries = useMemo(
    () => buildEntries(isCompanyAdmin, isPlatformAdmin, hasDirectReports, hasManager, hasOrgMembership),
    [isCompanyAdmin, isPlatformAdmin, hasDirectReports, hasManager, hasOrgMembership]
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    // Prefix matches on the label rank above keyword matches — typing "co"
    // should put Coach and Company before everything that merely mentions
    // them in keywords.
    const prefix: Entry[] = [];
    const rest: Entry[] = [];
    for (const e of entries) {
      const label = t(e.labelKey).toLowerCase();
      if (label.startsWith(q) || label.split(" ").some((w) => w.startsWith(q))) prefix.push(e);
      else if (label.includes(q) || e.keywords.includes(q)) rest.push(e);
    }
    return [...prefix, ...rest];
  }, [entries, query, t]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSelected(0);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    function onOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Derived, not synced via an effect (project lint forbids
  // setState-in-effect): when the result list shrinks under the raw
  // selection index, the highlight just clamps to the last row.
  const activeIndex = results.length === 0 ? 0 : Math.min(selected, results.length - 1);

  function go(entry: Entry) {
    close();
    router.push(entry.href);
  }

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected(Math.min(activeIndex + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected(Math.max(activeIndex - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[activeIndex]) go(results[activeIndex]);
    } else if (e.key === "Escape") {
      close();
    }
  }

  if (!open) return null;

  return (
    <div
      onClick={close}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(3,8,16,0.6)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "18vh",
        zIndex: 2000,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("dialogLabel")}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, calc(100vw - 32px))",
          background: "var(--navy-mid)",
          border: "1px solid rgba(0,201,167,0.3)",
          borderRadius: 14,
          boxShadow: "0 24px 90px rgba(0,0,0,0.55)",
          overflow: "hidden",
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(0);
          }}
          onKeyDown={handleInputKeyDown}
          placeholder={t("placeholder")}
          aria-label={t("searchAriaLabel")}
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            borderBottom: "1px solid var(--border)",
            padding: "16px 18px",
            fontSize: 15,
            color: "var(--text)",
            outline: "none",
          }}
        />
        <div style={{ maxHeight: "46vh", overflowY: "auto", padding: 6 }}>
          {results.length === 0 && (
            <p style={{ padding: "14px 12px", fontSize: 13, color: "var(--text-muted)" }}>
              {t("nothingMatches", { query })}
            </p>
          )}
          {results.map((entry, i) => (
            <button
              key={entry.href}
              type="button"
              onClick={() => go(entry)}
              onMouseEnter={() => setSelected(i)}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                width: "100%",
                textAlign: "left",
                background: i === activeIndex ? "rgba(0,201,167,0.12)" : "transparent",
                border: "none",
                borderRadius: 8,
                padding: "10px 12px",
                cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: i === activeIndex ? "var(--teal)" : "var(--text)" }}>
                {t(entry.labelKey)}
              </span>
              {entry.hintKey && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t(entry.hintKey)}</span>}
              {i === activeIndex && (
                <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>↵</span>
              )}
            </button>
          ))}
        </div>
        <div style={{ borderTop: "1px solid var(--border)", padding: "8px 14px", display: "flex", gap: 14 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("navigate")}</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("open")}</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("close")}</span>
        </div>
      </div>
    </div>
  );
}
