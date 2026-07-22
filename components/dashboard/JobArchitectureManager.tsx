"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createJobFamily,
  deleteJobFamily,
  createJobRole,
  deleteJobRole,
  addRoleTransition,
  removeRoleTransition,
  suggestRoleGrading,
  generateJobDescription,
  saveJobDescription,
  type RoleGradingSuggestion,
} from "@/lib/jobArchitecture/actions";
import { COMPETENCY_DIMENSIONS } from "@/lib/gap-analysis/dimensions";
import type { JobFamily, JobRole, RoleCompetencyRequirement, RoleTransition, RoleTrack } from "@/lib/supabase/types";

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

const TRACK_LABEL: Record<RoleTrack, string> = { ic: "Individual contributor", management: "Management" };

export default function JobArchitectureManager({
  families,
  roles,
  requirements,
  transitions,
}: {
  families: JobFamily[];
  roles: JobRole[];
  requirements: RoleCompetencyRequirement[];
  transitions: RoleTransition[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [showAddFamily, setShowAddFamily] = useState(false);
  const [familyName, setFamilyName] = useState("");
  const [familyDesc, setFamilyDesc] = useState("");
  const [addingRoleFor, setAddingRoleFor] = useState<string | null>(null);

  const roleById = new Map(roles.map((r) => [r.id, r]));
  const reqsByRole = new Map<string, RoleCompetencyRequirement[]>();
  for (const r of requirements) {
    const list = reqsByRole.get(r.role_id) ?? [];
    list.push(r);
    reqsByRole.set(r.role_id, list);
  }

  function refresh() {
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}

      {/* Add family */}
      {showAddFamily ? (
        <div style={card}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>New job family</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input style={input} placeholder="Family name — e.g. Engineering, Sales, Finance" value={familyName} onChange={(e) => setFamilyName(e.target.value)} />
            <input style={input} placeholder="Short description (optional)" value={familyDesc} onChange={(e) => setFamilyDesc(e.target.value)} />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                disabled={isPending}
                style={primaryBtn}
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    const result = await createJobFamily(familyName, familyDesc);
                    if (result?.error) setError(result.error);
                    else {
                      setFamilyName("");
                      setFamilyDesc("");
                      setShowAddFamily(false);
                      refresh();
                    }
                  })
                }
              >
                Create family
              </button>
              <button type="button" style={ghostBtn} onClick={() => setShowAddFamily(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button type="button" style={{ ...primaryBtn, alignSelf: "flex-start" }} onClick={() => setShowAddFamily(true)}>
          + Add job family
        </button>
      )}

      {families.length === 0 && (
        <div style={card}>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
            No families yet. Start with a functional grouping (Engineering, Sales, Finance…), then add
            roles inside it — the AI can propose each role&apos;s grade and competency profile from its
            responsibilities.
          </p>
        </div>
      )}

      {families.map((family) => {
        const familyRoles = roles.filter((r) => r.job_family_id === family.id).sort((a, b) => b.grade - a.grade);
        return (
          <div key={family.id} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{family.name}</h2>
                {family.description && <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{family.description}</p>}
              </div>
              <button
                type="button"
                style={{ ...ghostBtn, color: "#f87171", borderColor: "rgba(248,113,113,0.35)" }}
                onClick={() =>
                  startTransition(async () => {
                    await deleteJobFamily(family.id);
                    refresh();
                  })
                }
              >
                Delete family
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
              {familyRoles.map((role) => (
                <RoleCard key={role.id} role={role} requirements={reqsByRole.get(role.id) ?? []} onChanged={refresh} />
              ))}
            </div>

            {addingRoleFor === family.id ? (
              <AddRoleForm
                familyId={family.id}
                onDone={() => {
                  setAddingRoleFor(null);
                  refresh();
                }}
                onCancel={() => setAddingRoleFor(null)}
              />
            ) : (
              <button type="button" style={{ ...ghostBtn, marginTop: 14 }} onClick={() => setAddingRoleFor(family.id)}>
                + Add role to {family.name}
              </button>
            )}
          </div>
        );
      })}

      {/* Career paths (transitions) */}
      {roles.length >= 2 && (
        <TransitionsPanel roles={roles} transitions={transitions} roleById={roleById} onChanged={refresh} />
      )}
    </div>
  );
}

function gradeColor(grade: number): string {
  if (grade >= 8) return "var(--phase3)";
  if (grade >= 6) return "var(--teal)";
  if (grade >= 4) return "var(--amber)";
  return "var(--text-muted)";
}

function JDBuilder({ role }: { role: JobRole }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(role.generated_jd ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [isPending, startTransition] = useTransition();

  function generate() {
    setError(null);
    setSaved(false);
    setGenerating(true);
    startTransition(async () => {
      const result = await generateJobDescription(role.id);
      setGenerating(false);
      if ("error" in result) setError(result.error);
      else setText(result.formatted);
    });
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveJobDescription(role.id, text);
      if (result?.error) setError(result.error);
      else setSaved(true);
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setSaved(true);
    } catch {
      // Clipboard access can fail (permissions, insecure context) — not
      // worth surfacing as an error, the textarea is right there to
      // select-and-copy manually either way.
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 8, padding: "5px 12px", fontSize: 11.5, fontWeight: 700, color: "#a78bfa", cursor: "pointer", flexShrink: 0 }}
      >
        {role.generated_jd ? "View JD" : "✨ Generate JD"}
      </button>
    );
  }

  return (
    <div style={{ marginTop: 12, background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 10, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <p style={{ fontSize: 11.5, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.05em" }}>Job description</p>
        <button type="button" onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11.5, cursor: "pointer" }}>
          Close
        </button>
      </div>
      {!text && !generating && <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>Nothing generated yet for this role.</p>}
      {text && (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ ...input, minHeight: 220, resize: "vertical", fontFamily: "inherit", fontSize: 12.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}
        />
      )}
      {error && <p style={{ color: "#f87171", fontSize: 12, marginTop: 6 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={generate} disabled={generating} style={{ ...ghostBtn, color: "#a78bfa", borderColor: "rgba(167,139,250,0.3)", opacity: generating ? 0.6 : 1 }}>
          {generating ? "Generating…" : text ? "Regenerate" : "Generate from role data"}
        </button>
        {text && (
          <>
            <button type="button" onClick={save} disabled={isPending} style={{ ...primaryBtn, opacity: isPending ? 0.6 : 1 }}>
              {isPending ? "Saving…" : "Save edits"}
            </button>
            <button type="button" onClick={copy} style={ghostBtn}>
              Copy
            </button>
          </>
        )}
        {saved && <span style={{ fontSize: 11.5, color: "var(--teal)", fontWeight: 700, alignSelf: "center" }}>Saved</span>}
      </div>
    </div>
  );
}

function RoleCard({ role, requirements, onChanged }: { role: JobRole; requirements: RoleCompetencyRequirement[]; onChanged: () => void }) {
  const [isPending, startTransition] = useTransition();
  const sorted = [...requirements].sort((a, b) => b.target_level - a.target_level);
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16, background: "rgba(255,255,255,0.02)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span
          className="mono"
          style={{
            flexShrink: 0,
            width: 40,
            height: 40,
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 15,
            fontWeight: 800,
            color: "#0A0F1E",
            background: gradeColor(role.grade),
          }}
          title={`Grade ${role.grade}`}
        >
          {role.grade}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text)" }}>{role.title}</span>
            {role.level && (
              <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--teal)", background: "rgba(0,201,167,0.1)", border: "1px solid rgba(0,201,167,0.3)", borderRadius: 999, padding: "2px 8px" }}>
                {role.level}
              </span>
            )}
            <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{TRACK_LABEL[role.track]}</span>
          </div>
          {role.responsibilities && (
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5 }}>{role.responsibilities}</p>
          )}
        </div>
        <JDBuilder role={role} />
        <button
          type="button"
          disabled={isPending}
          style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", flexShrink: 0 }}
          onClick={() =>
            startTransition(async () => {
              await deleteJobRole(role.id);
              onChanged();
            })
          }
        >
          Delete
        </button>
      </div>

      {sorted.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 5 }}>
          <p style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Required competencies
          </p>
          {sorted.map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 150, fontSize: 11.5, color: "var(--text-muted)" }}>{r.dimension}</span>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ width: `${r.target_level}%`, height: "100%", background: "var(--teal)" }} />
              </div>
              <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)", width: 28, textAlign: "right" }}>{r.target_level}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddRoleForm({ familyId, onDone, onCancel }: { familyId: string; onDone: () => void; onCancel: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [responsibilities, setResponsibilities] = useState("");
  const [level, setLevel] = useState("");
  const [grade, setGrade] = useState(3);
  const [track, setTrack] = useState<RoleTrack>("ic");
  const [rationale, setRationale] = useState("");
  const [reqs, setReqs] = useState<Record<string, number>>({});

  function applySuggestion(s: RoleGradingSuggestion) {
    setGrade(s.grade);
    setTrack(s.track);
    setLevel(s.level);
    setRationale(s.rationale);
    const next: Record<string, number> = {};
    for (const r of s.competencyRequirements) next[r.dimension] = r.targetLevel;
    setReqs(next);
  }

  return (
    <div style={{ border: "1px solid rgba(0,201,167,0.3)", borderRadius: 12, padding: 16, marginTop: 14, background: "rgba(0,201,167,0.03)" }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>New role</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input style={input} placeholder="Role title — e.g. Senior Backend Engineer" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea
          style={{ ...input, resize: "vertical" }}
          rows={3}
          placeholder="Key responsibilities (the AI grades from this)"
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
              const result = await suggestRoleGrading(title, responsibilities);
              setSuggesting(false);
              if ("error" in result) setError(result.error);
              else applySuggestion(result.suggestion);
            });
          }}
        >
          {suggesting ? "Analyzing…" : "✨ Suggest grade & competencies with AI"}
        </button>

        {rationale && (
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5, fontStyle: "italic", borderLeft: "2px solid var(--teal)", paddingLeft: 10 }}>
            {rationale}
          </p>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
            Grade (1–10)
            <input type="number" min={1} max={10} style={{ ...input, width: 90 }} value={grade} onChange={(e) => setGrade(Number(e.target.value))} />
          </label>
          <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
            Level label
            <input style={{ ...input, width: 120 }} placeholder="IC3 / M2" value={level} onChange={(e) => setLevel(e.target.value)} />
          </label>
          <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
            Track
            <select style={{ ...input, width: 180, cursor: "pointer" }} value={track} onChange={(e) => setTrack(e.target.value as RoleTrack)}>
              <option value="ic">Individual contributor</option>
              <option value="management">Management</option>
            </select>
          </label>
        </div>

        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
            Required competency levels (0 = not required)
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 8 }}>
            {COMPETENCY_DIMENSIONS.map((dim) => (
              <div key={dim} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1, fontSize: 11.5, color: "var(--text-muted)" }}>{dim}</span>
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

        {error && <p style={{ color: "#f87171", fontSize: 12 }}>{error}</p>}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            disabled={isPending || !title.trim()}
            style={{ ...primaryBtn, opacity: isPending || !title.trim() ? 0.5 : 1 }}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const requirements = COMPETENCY_DIMENSIONS.map((dim) => ({ dimension: dim, targetLevel: reqs[dim] ?? 0 })).filter(
                  (r) => r.targetLevel > 0
                );
                const result = await createJobRole({ jobFamilyId: familyId, title, level, grade, track, responsibilities, requirements });
                if (result?.error) setError(result.error);
                else onDone();
              })
            }
          >
            Save role
          </button>
          <button type="button" style={ghostBtn} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function TransitionsPanel({
  roles,
  transitions,
  roleById,
  onChanged,
}: {
  roles: JobRole[];
  transitions: RoleTransition[];
  roleById: Map<string, JobRole>;
  onChanged: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [fromId, setFromId] = useState(roles[0]?.id ?? "");
  const [toId, setToId] = useState(roles[1]?.id ?? "");
  const [type, setType] = useState<"vertical" | "horizontal">("vertical");
  const [error, setError] = useState<string | null>(null);

  return (
    <div style={card}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>Career paths</h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, marginBottom: 16, lineHeight: 1.5, maxWidth: 640 }}>
        Endorsed moves between roles — vertical (promotion) or horizontal (lateral). These are the
        deliberate paths; the mobility engine will later also surface untapped adjacencies from
        competency distance.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
        {transitions.length === 0 && <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>No paths defined yet.</p>}
        {transitions.map((t) => {
          const from = roleById.get(t.from_role_id);
          const to = roleById.get(t.to_role_id);
          if (!from || !to) return null;
          return (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
              <span style={{ color: "var(--text)" }}>{from.title}</span>
              <span style={{ color: t.transition_type === "vertical" ? "var(--teal)" : "var(--amber)", fontWeight: 700, fontSize: 11 }}>
                {t.transition_type === "vertical" ? "↑ promotes to" : "→ moves to"}
              </span>
              <span style={{ color: "var(--text)" }}>{to.title}</span>
              <button
                type="button"
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11, cursor: "pointer", marginLeft: "auto" }}
                onClick={() =>
                  startTransition(async () => {
                    await removeRoleTransition(t.id);
                    onChanged();
                  })
                }
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select style={{ ...input, flex: "1 1 180px", cursor: "pointer" }} value={fromId} onChange={(e) => setFromId(e.target.value)}>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title} (G{r.grade})
            </option>
          ))}
        </select>
        <select style={{ ...input, width: 130, cursor: "pointer" }} value={type} onChange={(e) => setType(e.target.value as "vertical" | "horizontal")}>
          <option value="vertical">↑ vertical</option>
          <option value="horizontal">→ horizontal</option>
        </select>
        <select style={{ ...input, flex: "1 1 180px", cursor: "pointer" }} value={toId} onChange={(e) => setToId(e.target.value)}>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title} (G{r.grade})
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={isPending}
          style={primaryBtn}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await addRoleTransition(fromId, toId, type, "");
              if (result?.error) setError(result.error);
              else onChanged();
            })
          }
        >
          Add path
        </button>
      </div>
      {error && <p style={{ color: "#f87171", fontSize: 12, marginTop: 8 }}>{error}</p>}
    </div>
  );
}
