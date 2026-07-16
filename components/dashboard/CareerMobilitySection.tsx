import MemberRoleSelector from "@/components/dashboard/MemberRoleSelector";
import type { JobRole } from "@/lib/supabase/types";
import type { Mobility, MoveOption, UntappedRole, DevelopmentGap } from "@/lib/jobArchitecture/mobility";

const card: React.CSSProperties = {
  background: "var(--navy-mid)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  padding: 24,
};

function readinessColor(pct: number): string {
  if (pct >= 85) return "var(--teal)";
  if (pct >= 60) return "var(--amber)";
  return "var(--text-muted)";
}

function GapList({ gaps }: { gaps: DevelopmentGap[] }) {
  if (gaps.length === 0) {
    return <p style={{ fontSize: 11.5, color: "var(--teal)", marginTop: 4 }}>Already meets every requirement — ready now.</p>;
  }
  return (
    <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
      {gaps.slice(0, 4).map((g) => (
        <span
          key={g.dimension}
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "2px 8px",
          }}
        >
          {g.dimension} <span className="mono" style={{ color: "var(--text)" }}>{g.current}→{g.required}</span>
        </span>
      ))}
    </div>
  );
}

function MoveCard({ move, kind }: { move: MoveOption; kind: "vertical" | "horizontal" }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14, background: "rgba(255,255,255,0.02)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>
          {kind === "vertical" ? "↑ " : "→ "}
          {move.role.title}
        </span>
        <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: readinessColor(move.readinessPercent) }}>
          {move.readinessPercent}% ready
        </span>
      </div>
      <div style={{ marginTop: 6, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{ width: `${move.readinessPercent}%`, height: "100%", background: readinessColor(move.readinessPercent) }} />
      </div>
      <GapList gaps={move.developmentGaps} />
    </div>
  );
}

function UntappedCard({ item }: { item: UntappedRole }) {
  return (
    <div style={{ border: "1px solid rgba(125,211,252,0.25)", borderRadius: 12, padding: 14, background: "rgba(125,211,252,0.04)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{item.role.title}</span>
        <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: "var(--phase2)" }}>{item.matchPercent}% match</span>
      </div>
      <GapList gaps={item.topGaps} />
    </div>
  );
}

export default function CareerMobilitySection({
  mobility,
  memberId,
  currentRoleId,
  allRoles,
  employeeName,
}: {
  mobility: Mobility;
  memberId: string;
  currentRoleId: string | null;
  allRoles: JobRole[];
  employeeName: string;
}) {
  const firstName = employeeName.split(" ")[0];

  return (
    <div className="print-avoid-break" style={card}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
        Career mobility
      </h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6, maxWidth: 640 }}>
        Where {firstName} can move from their current role — vertical (promotion) and horizontal
        (lateral) paths, each with the development it would take, computed against your Job
        Architecture. &quot;Readiness&quot; is how much of a role&apos;s required competency profile they
        already meet.
      </p>

      <div className="no-print" style={{ marginBottom: 18 }}>
        <MemberRoleSelector memberId={memberId} currentRoleId={currentRoleId} roles={allRoles} />
      </div>

      {!mobility.currentRole ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
          Place {firstName} in a role above to see their vertical and horizontal paths.
        </p>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>
              From
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{mobility.currentRole.title}</span>
            <span className="mono" style={{ fontSize: 11, color: "var(--teal)", background: "rgba(0,201,167,0.1)", border: "1px solid rgba(0,201,167,0.3)", borderRadius: 999, padding: "2px 8px" }}>
              G{mobility.currentRole.grade}
              {mobility.currentRole.level ? ` · ${mobility.currentRole.level}` : ""}
            </span>
          </div>

          {!mobility.hasMeasuredData && (
            <p style={{ fontSize: 12, color: "var(--amber)", marginBottom: 14, lineHeight: 1.5 }}>
              {firstName} hasn&apos;t run a Gap Analysis yet, so readiness and development gaps can&apos;t
              be computed — the paths below are structural only until there&apos;s measured data.
            </p>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
            <div>
              <h3 style={{ fontSize: 12.5, fontWeight: 700, color: "var(--teal)", marginBottom: 10 }}>↑ Vertical — promotion paths</h3>
              {mobility.vertical.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No promotion paths defined from this role yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {mobility.vertical.map((m) => (
                    <MoveCard key={m.role.id} move={m} kind="vertical" />
                  ))}
                </div>
              )}
            </div>
            <div>
              <h3 style={{ fontSize: 12.5, fontWeight: 700, color: "var(--amber)", marginBottom: 10 }}>→ Horizontal — lateral moves</h3>
              {mobility.horizontal.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No lateral moves defined from this role yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {mobility.horizontal.map((m) => (
                    <MoveCard key={m.role.id} move={m} kind="horizontal" />
                  ))}
                </div>
              )}
            </div>
          </div>

          {mobility.untapped.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 12.5, fontWeight: 700, color: "var(--phase2)", marginBottom: 4 }}>
                ✦ Untapped — roles {firstName} is unexpectedly close to
              </h3>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 10, lineHeight: 1.5, maxWidth: 620 }}>
                Not on any endorsed path from their current role, but their measured competencies are
                a strong match — worth a conversation.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
                {mobility.untapped.map((u) => (
                  <UntappedCard key={u.role.id} item={u} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
