import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listMyAccountabilityGroups } from "@/lib/accountability/actions";
import AccountabilityGroupsView from "@/components/dashboard/AccountabilityGroupsView";

export const metadata = { title: "Accountability Groups — Devometrics" };

export default async function AccountabilityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { groups, error } = await listMyAccountabilityGroups();

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← Back to progress
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            Accountability Groups
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 640 }}>
            Small peer groups that keep each other on track — share what you&apos;re working on, post
            check-ins, and see how everyone else is progressing.
          </p>
        </div>

        {error ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
              Accountability Groups isn&apos;t enabled on this database yet — the{" "}
              <code style={{ color: "var(--teal)" }}>0075_accountability_groups.sql</code> migration needs
              to be run in the Supabase SQL Editor first.
            </p>
          </div>
        ) : (
          <AccountabilityGroupsView initial={groups} />
        )}
      </div>
    </div>
  );
}
