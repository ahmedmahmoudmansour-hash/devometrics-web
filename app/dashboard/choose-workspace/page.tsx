import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import ChooseWorkspaceCards from "@/components/dashboard/ChooseWorkspaceCards";

export const metadata = { title: "Choose your workspace — Devometrics" };

export default async function ChooseWorkspacePage() {
  const t = await getTranslations("chooseWorkspacePage");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role, organizations(name)")
    .eq("user_id", user.id)
    .maybeSingle<{ role: string; organizations: { name: string } | null }>();

  // Nothing to choose between if this account isn't a company admin —
  // someone reaching this URL directly (bookmark, back button) just goes
  // straight back to their one and only workspace.
  if (membership?.role !== "admin") redirect("/dashboard");

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
      <div style={{ maxWidth: 720, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>{t("title")}</h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
            {membership.organizations?.name ? t("descriptionWithOrg", { org: membership.organizations.name }) : t("description")}
          </p>
        </div>
        <ChooseWorkspaceCards
          employeeTitle={t("employeeTitle")}
          employeeDescription={t("employeeDescription")}
          adminTitle={t("adminTitle")}
          adminDescription={t("adminDescription")}
          rememberNote={t("rememberNote")}
        />
      </div>
    </div>
  );
}
