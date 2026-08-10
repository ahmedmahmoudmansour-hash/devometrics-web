import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import CareerPathsView from "@/components/dashboard/CareerPathsView";
import FeatureRestrictedNotice from "@/components/dashboard/FeatureRestrictedNotice";
import { getMyOrganizationId } from "@/lib/organizations/membership";
import { listMyRestrictedFeatures } from "@/lib/organizations/featureAccess";
import type { CareerPaths } from "@/lib/supabase/types";

export const metadata = { title: "Career Paths — Devometrics" };

export default async function CareerPathsPage() {
  const t = await getTranslations("careerPathsPage");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const organizationId = await getMyOrganizationId(supabase, user.id);
  const restricted = await listMyRestrictedFeatures(supabase, organizationId);

  // error is non-null when migration 0049 hasn't been run (missing table) —
  // show a setup notice instead of a broken page.
  const { data: saved, error } = await supabase
    .from("career_paths")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<CareerPaths>();

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToProgress")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            {t("title")}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 640 }}>
            {t("description")}
          </p>
        </div>

        {restricted.has("career_development") ? (
          <FeatureRestrictedNotice message={t("restrictedNotice")} />
        ) : error ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
              {t.rich("migrationNotice", { code: (chunks) => <code style={{ color: "var(--teal)" }}>{chunks}</code> })}
            </p>
          </div>
        ) : (
          <CareerPathsView saved={saved ?? null} />
        )}
      </div>
    </div>
  );
}
