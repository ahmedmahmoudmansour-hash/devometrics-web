import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyOrganizationMembership } from "@/lib/organizations/actions";
import CompanySetupForm from "@/components/dashboard/CompanySetupForm";

export default async function CompanySetupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await getMyOrganizationMembership();
  if (membership) redirect(membership.role === "admin" ? "/dashboard/company" : "/dashboard");

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← Back to progress
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            Set up your company workspace
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
            One more step before your dashboard — create a new company or join one you&apos;ve been
            invited to.
          </p>
        </div>
        <CompanySetupForm />
      </div>
    </div>
  );
}
