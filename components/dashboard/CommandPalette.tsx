"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export const OPEN_PALETTE_EVENT = "devometrics:open-palette";

type Entry = {
  label: string;
  href: string;
  hint?: string;
  keywords: string;
};

// Everything reachable in two keystrokes: Ctrl+K, type, Enter. The list is
// static and instant on purpose — no fetch, no spinner, no index to build.
function buildEntries(isCompanyAdmin: boolean, isPlatformAdmin: boolean): Entry[] {
  const entries: Entry[] = [
    { label: "Progress", href: "/dashboard", keywords: "home overview dashboard start" },
    { label: "AI Coach", href: "/dashboard/coach", hint: "Talk it through", keywords: "chat talk mentor advice session" },
    { label: "Book coaching sessions", href: "/dashboard/coach/book", hint: "Schedule a cadence", keywords: "schedule appointment calendar reminder book" },
    { label: "Gap Analysis", href: "/dashboard/gap-analysis", hint: "CV vs target role", keywords: "cv resume job description competency gap" },
    { label: "Assessments", href: "/dashboard/assessments", keywords: "test quiz evaluate skills big five personality" },
    { label: "Practice Scenarios", href: "/dashboard/roleplay", hint: "Interview & hard conversations", keywords: "roleplay interview practice negotiation feedback" },
    { label: "Career Paths", href: "/dashboard/career-paths", hint: "Where you can go next", keywords: "map future promotion readiness next role" },
    { label: "Tasks & Calendar", href: "/dashboard/tasks", keywords: "todo task calendar day week plan sync outlook google" },
    { label: "Workspace", href: "/dashboard/notes", hint: "Private notes + AI", keywords: "notes ideas write second brain action items" },
    { label: "Discovery", href: "/dashboard/discovery", hint: "AI interview about you", keywords: "interview questions profile onboarding" },
    { label: "Resume Intelligence", href: "/dashboard/resume", keywords: "cv ats score keywords bullets" },
    { label: "Scorecard", href: "/dashboard/scorecard", keywords: "score career health momentum badges" },
    { label: "My Development", href: "/dashboard/plans", hint: "All your plans and milestones", keywords: "plans milestones status in progress completed deferred track" },
    { label: "My Journey", href: "/dashboard/journey", hint: "Your story so far", keywords: "history timeline progress log" },
    { label: "Profile", href: "/dashboard/profile", keywords: "account avatar settings preferences experience education" },
  ];
  if (isCompanyAdmin) {
    entries.push(
      { label: "Company", href: "/dashboard/company", keywords: "organization workspace admin hr" },
      { label: "Employees", href: "/dashboard/company/employees", hint: "Workforce & heatmap", keywords: "team workforce heatmap staff hr edit archive" }
    );
  }
  if (isPlatformAdmin) {
    entries.push(
      { label: "Admin", href: "/dashboard/admin", keywords: "platform pilot tracking" },
      { label: "Contact inquiries", href: "/dashboard/admin/inquiries", hint: "Sales/support/careers messages", keywords: "contact form messages sales support careers inbox" }
    );
  }
  return entries;
}

export default function CommandPalette({
  isCompanyAdmin,
  isPlatformAdmin,
}: {
  isCompanyAdmin: boolean;
  isPlatformAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const entries = useMemo(() => buildEntries(isCompanyAdmin, isPlatformAdmin), [isCompanyAdmin, isPlatformAdmin]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    // Prefix matches on the label rank above keyword matches — typing "co"
    // should put Coach and Company before everything that merely mentions
    // them in keywords.
    const prefix: Entry[] = [];
    const rest: Entry[] = [];
    for (const e of entries) {
      const label = e.label.toLowerCase();
      if (label.startsWith(q) || label.split(" ").some((w) => w.startsWith(q))) prefix.push(e);
      else if (label.includes(q) || e.keywords.includes(q)) rest.push(e);
    }
    return [...prefix, ...rest];
  }, [entries, query]);

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
        aria-label="Quick navigation"
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
          placeholder="Jump to… (type to search)"
          aria-label="Search pages and actions"
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
              Nothing matches &quot;{query}&quot;
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
                {entry.label}
              </span>
              {entry.hint && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{entry.hint}</span>}
              {i === activeIndex && (
                <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>↵</span>
              )}
            </button>
          ))}
        </div>
        <div style={{ borderTop: "1px solid var(--border)", padding: "8px 14px", display: "flex", gap: 14 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>↑↓ navigate</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>↵ open</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>esc close</span>
        </div>
      </div>
    </div>
  );
}
