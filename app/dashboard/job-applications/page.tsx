import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listJobApplications } from "@/lib/jobApplications/actions";
import JobApplicationsView from "@/components/dashboard/JobApplicationsView";

export const metadata = { title: "Job Applications — Devometrics" };

export default async function JobApplicationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { applications, error } = await listJobApplications();

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← Back to progress
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            Job Applications
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 640 }}>
            Track every role you&apos;re pursuing — stage, next action, and notes in one place instead of
            a spreadsheet. Entirely private to you.
          </p>
        </div>

        {error ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
              Job Applications isn&apos;t enabled on this database yet — the{" "}
              <code style={{ color: "var(--teal)" }}>0073_job_applications.sql</code> migration needs to be
              run in the Supabase SQL Editor first.
            </p>
          </div>
        ) : (
          <JobApplicationsView initial={applications} />
        )}
      </div>
    </div>
  );
}
