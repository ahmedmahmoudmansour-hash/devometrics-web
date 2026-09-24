"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { EmploymentHistoryEvent } from "@/lib/employmentHistory/actions";

function eventLabel(e: EmploymentHistoryEvent, t: (key: string, values?: Record<string, string>) => string): string {
  const from = e.oldValue || t("none");
  const to = e.newValue || t("none");
  switch (e.eventType) {
    case "joined":
      return t("eventJoined");
    case "title_change":
      return t("eventTitleChange", { from, to });
    case "role_change":
      return t("eventRoleChange", { from, to });
    case "band_change":
      return t("eventBandChange", { from, to });
    case "status_change":
      return t("eventStatusChange", { from: t(`status_${e.oldValue ?? "active"}`), to: t(`status_${e.newValue ?? "active"}`) });
    default:
      return e.eventType;
  }
}

function EventRows({ events, t }: { events: EmploymentHistoryEvent[]; t: (key: string, values?: Record<string, string>) => string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {events.map((e, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            fontSize: 13,
            padding: "8px 0",
            borderBottom: i < events.length - 1 ? "1px solid var(--border)" : "none",
          }}
        >
          <span style={{ color: "var(--text)" }}>{eventLabel(e, t)}</span>
          <span style={{ color: "var(--text-muted)", fontSize: 12, whiteSpace: "nowrap" }}>{new Date(e.effectiveAt).toLocaleDateString()}</span>
        </div>
      ))}
    </div>
  );
}

// Read-only. `collapsible` is used wherever more than one of these could
// appear on a page at once (e.g. TeamEmploymentHistory, one per direct
// report) -- same "less visual clutter" reasoning behind the tabbed
// Compensation/Leave admin dashboards. `variant="bare"` drops the outer
// card chrome for exactly that case, since the parent already supplies
// its own per-employee card; the profile page's own self-view uses the
// default "card" variant since there's only ever one on that page.
export default function EmploymentHistoryTimeline({
  events,
  collapsible = false,
  variant = "card",
}: {
  events: EmploymentHistoryEvent[];
  collapsible?: boolean;
  variant?: "card" | "bare";
}) {
  const t = useTranslations("employmentHistory");
  const [expanded, setExpanded] = useState(!collapsible);

  if (events.length === 0) return null;

  if (variant === "bare") {
    return (
      <div>
        {collapsible && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", marginTop: 4 }}
          >
            {expanded ? t("hideButton") : t("showHistoryButton")}
          </button>
        )}
        {expanded && (
          <div style={{ marginTop: 10 }}>
            <EventRows events={events} t={t} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: expanded ? 14 : 0 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{t("title")}</h2>
        {collapsible && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}
          >
            {expanded ? t("hideButton") : t("showButton")}
          </button>
        )}
      </div>
      {expanded && <EventRows events={events} t={t} />}
    </div>
  );
}
