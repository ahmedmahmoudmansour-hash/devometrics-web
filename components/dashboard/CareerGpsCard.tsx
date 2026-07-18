import Link from "next/link";
import type { CareerGpsSnapshot } from "@/lib/careerGps/gps";

function scoreColor(score: number): string {
  if (score >= 70) return "var(--teal)";
  if (score >= 40) return "var(--amber)";
  return "#f87171";
}

export default function CareerGpsCard({ snapshot }: { snapshot: CareerGpsSnapshot }) {
  const { destination, promotionReadiness, interviewReadiness, topGaps, fastestRoute, estimatedReadinessAfter } = snapshot;

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            You are here → Current destination
          </p>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: "var(--text)", marginTop: 2 }}>{destination}</h2>
        </div>
        <Link href="/dashboard/career-paths" style={{ fontSize: 12, color: "var(--teal)", textDecoration: "none", whiteSpace: "nowrap" }}>
          Explore other directions →
        </Link>
      </div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <p className="mono" style={{ fontSize: 30, fontWeight: 800, color: scoreColor(promotionReadiness) }}>
            {promotionReadiness}%
          </p>
          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Promotion Readiness</p>
        </div>
        {interviewReadiness !== null && (
          <div>
            <p className="mono" style={{ fontSize: 30, fontWeight: 800, color: scoreColor(interviewReadiness) }}>
              {interviewReadiness}%
            </p>
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Interview Readiness</p>
          </div>
        )}
      </div>

      {topGaps.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            Remaining gaps
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {topGaps.map((g) => (
              <span
                key={g.dimension}
                style={{ fontSize: 12, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 999, padding: "4px 12px", color: "var(--text)" }}
              >
                {g.dimension}
              </span>
            ))}
          </div>
        </div>
      )}

      {fastestRoute.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Fastest route
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
            {fastestRoute.map((action) => (
              <Link
                key={action.href + action.label}
                href={action.href}
                style={{
                  fontSize: 13,
                  color: "var(--text)",
                  textDecoration: "none",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "8px 12px",
                }}
              >
                → {action.label}
              </Link>
            ))}
          </div>
          {estimatedReadinessAfter !== null && (
            <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
              Estimated readiness after completing these:{" "}
              <span style={{ color: "var(--teal)", fontWeight: 700 }}>{estimatedReadinessAfter}%</span>
              <span style={{ fontSize: 11 }}> — an estimate assuming real progress on your biggest gap, not a guarantee.</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
