import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyCurrentReview } from "@/lib/performanceReviews/actions";
import MyPerformanceReview from "@/components/dashboard/MyPerformanceReview";

export const metadata = { title: "Impact Cycle — Devometrics" };

export default async function ImpactCyclePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { detail, error } = await getMyCurrentReview();

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← Back to progress
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            Impact Cycle
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 640 }}>
            Your Reflection, your manager&apos;s Perspective once they&apos;ve shared it, and any Focus
            Areas set for this cycle.
          </p>
        </div>

        {error ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
              Impact Cycles isn&apos;t enabled on this database yet — the{" "}
              <code style={{ color: "var(--teal)" }}>0076_performance_appraisals.sql</code> migration
              needs to be run in the Supabase SQL Editor first.
            </p>
          </div>
        ) : detail ? (
          <MyPerformanceReview detail={detail} />
        ) : (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
              No Impact Cycle yet — this shows up once your organization&apos;s admin starts one for
              your team.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
