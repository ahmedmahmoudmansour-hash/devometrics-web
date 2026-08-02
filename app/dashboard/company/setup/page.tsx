import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getMyOrganizationMembership } from "@/lib/organizations/actions";
import CompanySetupForm from "@/components/dashboard/CompanySetupForm";

export default async function CompanySetupPage() {
  const t = await getTranslations("companySetupPage");
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
            {t("backToProgress")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            {t("title")}
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
            {t("description")}
          </p>
        </div>
        <CompanySetupForm />
      </div>
    </div>
  );
}
