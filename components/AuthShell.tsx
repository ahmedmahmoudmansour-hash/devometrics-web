import Link from "next/link";
import Logo from "@/components/Logo";

const BENEFITS = [
  "Score yourself against a real target role across 8 competency dimensions",
  "Get a development plan paced to your schedule and budget — not a generic checklist",
  "Practice with a career-focused AI coach that knows your actual gaps",
];

export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", display: "flex" }}>
      <div
        className="hidden md:flex"
        style={{
          flex: "0 0 42%",
          background:
            "radial-gradient(circle at 20% 20%, rgba(0,201,167,0.16), transparent 55%), radial-gradient(circle at 80% 80%, rgba(125,211,252,0.12), transparent 55%), var(--navy)",
          borderRight: "1px solid var(--border)",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px 44px",
        }}
      >
        <Logo size={34} />

        <div>
          <p
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "var(--text)",
              lineHeight: 1.4,
              marginBottom: 28,
            }}
          >
            Know exactly what&apos;s standing between you and your next role.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {BENEFITS.map((b) => (
              <div key={b} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span
                  style={{
                    flexShrink: 0,
                    width: 20,
                    height: 20,
                    borderRadius: 999,
                    background: "rgba(0,201,167,0.15)",
                    color: "var(--teal)",
                    fontSize: 12,
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 2,
                  }}
                >
                  ✓
                </span>
                <span style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>{b}</span>
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
          by Empiric Consultancy
        </p>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px 24px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 400 }}>
          <div className="md:hidden" style={{ marginBottom: 24 }}>
            <Logo size={30} />
          </div>
          <Link
            href="/"
            style={{ color: "var(--text-muted)", fontSize: 13, textDecoration: "none" }}
          >
            ← Back to Devometrics
          </Link>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "var(--text)",
              marginTop: 20,
              marginBottom: 8,
            }}
          >
            {title}
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 15, marginBottom: 32 }}>
            {subtitle}
          </p>
          <div
            style={{
              background: "var(--navy-mid)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 32,
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
