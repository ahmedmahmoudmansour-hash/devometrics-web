"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { importFromJobBank, type ImportReport } from "@/lib/jobBank/actions";
import type { BankSummaryFamily } from "@/lib/jobBank/summary";

const card = { background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, marginBottom: 20 } as const;
const norm = (s: string) => s.trim().toLowerCase();

export default function JobBankPanel({
  bank,
  existing,
  stats,
}: {
  bank: BankSummaryFamily[];
  existing: { familyNames: string[]; rolesByFamily: Record<string, string[]> };
  stats: { families: number; roles: number; competencies: number };
}) {
  const t = useTranslations("jobBank");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const have = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const [fam, titles] of Object.entries(existing.rolesByFamily)) m.set(fam, new Set(titles.map(norm)));
    return m;
  }, [existing.rolesByFamily]);
  const roleExists = (familyName: string, title: string) => have.get(norm(familyName))?.has(norm(title)) ?? false;

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  function toggleFamily(f: BankSummaryFamily) {
    const keys = f.roles.filter((r) => !roleExists(f.name, r.title)).map((r) => r.key);
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = keys.length > 0 && keys.every((k) => next.has(k));
      for (const k of keys) {
        if (allOn) next.delete(k);
        else next.add(k);
      }
      return next;
    });
  }

  function submit() {
    setError(null);
    setReport(null);
    const selection = bank.map((f) => ({ familyKey: f.key, roleKeys: f.roles.filter((r) => selected.has(r.key)).map((r) => r.key) })).filter((s) => s.roleKeys.length > 0);
    if (selection.length === 0) {
      setError(t("noneSelected"));
      return;
    }
    startTransition(async () => {
      const r = await importFromJobBank(selection);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setReport(r.report);
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <section style={card} aria-labelledby="job-bank-title">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ maxWidth: 720 }}>
          <h2 id="job-bank-title" style={{ fontSize: 17, fontWeight: 700, color: "var(--text)" }}>
            {t("title")}
          </h2>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6 }}>{t("intro")}</p>
          <p style={{ fontSize: 12, color: "var(--amber)", marginTop: 6, lineHeight: 1.6 }}>{t("notice")}</p>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>{t("stats", stats)}</p>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} style={{ background: "rgba(var(--teal-rgb),0.1)", border: "1px solid rgba(var(--teal-rgb),0.3)", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, color: "var(--teal)", cursor: "pointer" }}>
          {open ? t("hide") : t("browse")}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {bank.map((f) => {
            const available = f.roles.filter((r) => !roleExists(f.name, r.title));
            const allOn = available.length > 0 && available.every((r) => selected.has(r.key));
            return (
              <details key={f.key} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px" }}>
                <summary style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10, listStyle: "none" }}>
                  <input
                    type="checkbox"
                    checked={allOn}
                    disabled={available.length === 0}
                    onChange={() => toggleFamily(f)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={f.name}
                  />
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{f.name}</span>
                  <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t("familyRoles", { count: f.roles.length })}</span>
                  {available.length === 0 && <span style={{ fontSize: 11, color: "var(--teal)", fontWeight: 600 }}>{t("alreadyAdded")}</span>}
                </summary>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "8px 0 6px" }}>{f.description}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {f.roles.map((r) => {
                    const exists = roleExists(f.name, r.title);
                    return (
                      <div key={r.key} style={{ borderTop: "1px solid var(--border)", paddingTop: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <input type="checkbox" checked={selected.has(r.key)} disabled={exists} onChange={() => toggle(r.key)} aria-label={r.title} />
                          <span style={{ fontSize: 13, color: exists ? "var(--text-muted)" : "var(--text)", fontWeight: 600 }}>{r.title}</span>
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            {r.level} · {r.grade}
                          </span>
                          {exists && <span style={{ fontSize: 11, color: "var(--teal)", fontWeight: 600 }}>{t("alreadyAdded")}</span>}
                        </div>
                        <details style={{ marginInlineStart: 26 }}>
                          <summary style={{ fontSize: 11.5, color: "var(--teal)", cursor: "pointer" }}>{t("seeRequirements")}</summary>
                          <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "4px 0", lineHeight: 1.5 }}>{r.responsibilities}</p>
                          <ul style={{ margin: 0, paddingInlineStart: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {r.requires.map((q) => (
                              <li key={q.name} style={{ fontSize: 11, color: "var(--text)", border: "1px solid var(--border)", borderRadius: 999, padding: "2px 9px", opacity: q.core ? 0.75 : 1 }}>
                                {q.name} · {t("level", { n: q.level })}
                              </li>
                            ))}
                          </ul>
                        </details>
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })}

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 6 }}>
            <button
              type="button"
              onClick={submit}
              disabled={pending || selected.size === 0}
              style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: pending || selected.size === 0 ? 0.6 : 1 }}
            >
              {pending ? t("adding") : t("add", { count: selected.size })}
            </button>
            {selected.size > 0 && (
              <button type="button" onClick={() => setSelected(new Set())} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>
                {t("clear")}
              </button>
            )}
          </div>
          {error && (
            <p role="alert" style={{ color: "var(--danger)", fontSize: 13 }}>
              {error}
            </p>
          )}
          {report && (
            <p role="status" style={{ color: "var(--teal)", fontSize: 13, lineHeight: 1.6 }}>
              {t("result", { roles: report.rolesCreated, competencies: report.competenciesCreated, families: report.familiesCreated, existingRoles: report.rolesExisting, existingCompetencies: report.competenciesExisting })}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
