import { createClient } from "@/lib/supabase/server";
import SidebarNav from "@/components/dashboard/SidebarNav";
import { effectiveSubscriptionTier } from "@/lib/billing/subscriptionTier";

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

  const [{ data: membership }, { data: profile }] = await Promise.all([
    supabase
      .from("organization_members")
      .select("role, organizations(brand_color)")
      .eq("user_id", user.id)
      .maybeSingle<{ role: string; organizations: { brand_color: string | null } | null }>(),
    supabase
      .from("profiles")
      .select("is_admin, theme, subscription_tier, premium_trial_expires_at")
      .eq("id", user.id)
      .maybeSingle<{ is_admin: boolean | null; theme: string | null; subscription_tier: string | null; premium_trial_expires_at: string | null }>(),
  ]);

  const brandColor = membership?.organizations?.brand_color ?? null;
  const isFreeTier =
    effectiveSubscriptionTier(
      profile
        ? {
            subscription_tier: (profile.subscription_tier ?? "free") as "free" | "premium" | "enterprise",
            premium_trial_expires_at: profile.premium_trial_expires_at,
            is_admin: !!profile.is_admin,
          }
        : null
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
        <SidebarNav
          savedTheme={profile?.theme}
          isCompanyAdmin={membership?.role === "admin"}
          isPlatformAdmin={!!profile?.is_admin}
          isFreeTier={isFreeTier}
        />
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      </div>
    </div>
  );
}
