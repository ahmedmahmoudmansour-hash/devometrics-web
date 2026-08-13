import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SidebarNav from "@/components/dashboard/SidebarNav";
import CommandPalette from "@/components/dashboard/CommandPalette";
import { effectiveSubscriptionTier } from "@/lib/billing/subscriptionTier";
import { listMyRestrictedFeatures } from "@/lib/organizations/featureAccess";
import { getNextOnboardingStep } from "@/lib/dashboard/onboardingStatus";

// Single place where an enterprise workspace's accent color reaches every
// dashboard page — every page already renders with var(--teal), so
// overriding the CSS custom property once here means no per-page plumbing.
// Also the single place the sidebar nav is wired in, replacing the old
// per-page top nav row that grew to 11 items and had to be rebuilt on
// every page that wanted it (in practice only the home page ever did).
// Deliberately scoped to just the /dashboard tree (not the root layout):
// the public marketing site stays statically optimized, and this is the
// only place in the app that already needs a per-request user lookup on
// every dashboard page anyway.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <>{children}</>;

  const [{ data: membership }, { data: profile }, { count: directReportCount }, nextOnboardingStep] = await Promise.all([
    supabase
      .from("organization_members")
      .select("role, manager_user_id, organization_id, organizations(brand_color, is_disabled)")
      .eq("user_id", user.id)
      .maybeSingle<{ role: string; manager_user_id: string | null; organization_id: string; organizations: { brand_color: string | null; is_disabled: boolean | null } | null }>(),
    supabase
      .from("profiles")
      .select("is_admin, theme, subscription_tier, premium_trial_expires_at, is_disabled")
      .eq("id", user.id)
      .maybeSingle<{ is_admin: boolean | null; theme: string | null; subscription_tier: string | null; premium_trial_expires_at: string | null; is_disabled: boolean | null }>(),
    // Isolated defensive count — degrades to "no reports" rather than
    // breaking the whole layout if 0072's manager_user_id column isn't
    // migrated yet on this database.
    supabase.from("organization_members").select("*", { count: "exact", head: true }).eq("manager_user_id", user.id),
    // Powers a persistent "what's next" nudge in the sidebar for a new
    // user who's navigated away from the home page's full checklist
    // (2026-08-13 feedback: people lose the "where do I start" thread once
    // they click into Coach/Tasks/etc.). Existence-only lookups, cheap
    // enough to run on every dashboard page load.
    getNextOnboardingStep(),
  ]);
  // A disabled account (0112) or a disabled company workspace (0113) both
  // keep their login (this app has no service-role key to revoke it) but
  // are blocked from every dashboard route right here — the one place
  // every dashboard page already does a per-request profile/membership
  // lookup, so this can't be bypassed by landing on a different page. Org
  // disable exists separately because enterprise has no "free" fallback
  // tier — blocking one admin's profile wouldn't lock out the rest of a
  // company that stopped paying.
  if (profile?.is_disabled || membership?.organizations?.is_disabled) {
    await supabase.auth.signOut();
    redirect("/login?disabled=1");
  }

  const hasDirectReports = (directReportCount ?? 0) > 0;
  const hasManager = !!membership?.manager_user_id;
  const hasOrgMembership = !!membership;
  // Array, not the Set listMyRestrictedFeatures() returns — Set instances
  // aren't part of the RSC serialization boundary, and SidebarNav/
  // CommandPalette are both Client Components.
  const restrictedFeatures = [...(await listMyRestrictedFeatures(supabase, membership?.organization_id ?? null))];

  const brandColor = membership?.organizations?.brand_color ?? null;
  const isFreeTier =
    effectiveSubscriptionTier(
      profile
        ? {
            subscription_tier: (profile.subscription_tier ?? "free") as "free" | "premium" | "enterprise",
            premium_trial_expires_at: profile.premium_trial_expires_at,
            is_admin: !!profile.is_admin,
          }
        : null,
      hasOrgMembership
    ) === "free";

  return (
    <div
      style={
        (brandColor
          ? { "--teal": brandColor, "--teal-dim": brandColor, "--teal-glow": `${brandColor}26` }
          : {}) as React.CSSProperties
      }
    >
      <div style={{ display: "flex", minHeight: "100vh" }}>
        {/* The sidebar was never excluded from print output before — every
            existing "Download PDF" button (Plans, Employee Report, Bridge
            content) has printed the nav chrome alongside the actual content
            this whole time. Wrapping it here fixes that globally, not just
            for the Org Chart's new export button. */}
        <div className="no-print">
          <SidebarNav
            savedTheme={profile?.theme}
            isCompanyAdmin={membership?.role === "admin"}
            isPlatformAdmin={!!profile?.is_admin}
            isFreeTier={isFreeTier}
            hasDirectReports={hasDirectReports}
            hasManager={hasManager}
            hasOrgMembership={hasOrgMembership}
            restrictedFeatures={restrictedFeatures}
            nextOnboardingStep={nextOnboardingStep}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      </div>
      <CommandPalette
        isCompanyAdmin={membership?.role === "admin"}
        isPlatformAdmin={!!profile?.is_admin}
        hasDirectReports={hasDirectReports}
        hasManager={hasManager}
        hasOrgMembership={hasOrgMembership}
      />
    </div>
  );
}
