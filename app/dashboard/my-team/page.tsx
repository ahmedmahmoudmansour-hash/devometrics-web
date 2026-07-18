import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listMyDirectReportReviews } from "@/lib/performanceReviews/actions";
import MyTeamReviews from "@/components/dashboard/MyTeamReviews";

export const metadata = { title: "My Team — Devometrics" };

// For a real reporting-line manager who ISN'T necessarily an org admin
// (migration 0078) — the admin-only Impact Cycles page manages cycles
// org-wide; this is the narrower "conduct my own direct reports' reviews"
// surface a plain manager actually needs.
export default async function MyTeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { items, error } = await listMyDirectReportReviews();

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← Back to progress
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            My Team
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 640 }}>
            Your direct reports&apos; Impact Cycles — submit your Manager&apos;s Perspective, set Focus
            Areas, and close cycles for the people who report to you.
          </p>
        </div>

        {error ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
              This isn&apos;t enabled on this database yet — the{" "}
              <code style={{ color: "var(--teal)" }}>0072_reporting_lines.sql</code> migration needs to
              be run in the Supabase SQL Editor first.
            </p>
          </div>
        ) : (
          <MyTeamReviews initial={items} />
        )}
      </div>
    </div>
  );
}
