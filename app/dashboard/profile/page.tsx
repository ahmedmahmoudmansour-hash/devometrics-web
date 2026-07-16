import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyOrganizationMembership } from "@/lib/organizations/actions";
import CapabilityPyramid from "@/components/CapabilityPyramid";
import BigFiveAssessment from "@/components/dashboard/BigFiveAssessment";
import BigFiveSharingToggle from "@/components/dashboard/BigFiveSharingToggle";
import ProfileSettings from "@/components/dashboard/ProfileSettings";
import ProfileHeader from "@/components/dashboard/ProfileHeader";
import CareerProfileForm from "@/components/dashboard/CareerProfileForm";
import type { BigFiveProfile, GapAnalysis, Profile } from "@/lib/supabase/types";
import type { CompetencyDimension } from "@/lib/gap-analysis/dimensions";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  const { data: latestAnalysis } = await supabase
    .from("gap_analyses")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<GapAnalysis>();

  const { data: latestBigFive } = await supabase
    .from("big_five_profiles")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<BigFiveProfile>();

  const membership = await getMyOrganizationMembership();

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ marginBottom: 8 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← Back to progress
          </Link>
        </div>

        <ProfileHeader
          profile={profile}
          membershipTitle={membership?.title}
          organizationName={membership?.organization_name}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
              Your capability pyramid
            </h2>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
              Your 8 competency dimensions grouped by how they build on each other.
            </p>
            <CapabilityPyramid
              dimensionLevels={
                latestAnalysis
                  ? latestAnalysis.competencies.reduce<Partial<Record<CompetencyDimension, number>>>(
                      (acc, c) => ({ ...acc, [c.dimension]: c.currentLevel }),
                      {}
                    )
                  : undefined
              }
            />
          </div>

          <CareerProfileForm
            initialJobHistory={profile?.job_history ?? []}
            initialSkills={profile?.skills ?? []}
            initialQualifications={profile?.qualifications ?? []}
            initialCareerAspirations={profile?.career_aspirations ?? ""}
          />

          <div>
            <BigFiveAssessment latest={latestBigFive} />
            {latestBigFive && membership && (
              <BigFiveSharingToggle
                organizationName={membership.organization_name ?? "your company"}
                initialShared={profile?.share_big_five_with_admin ?? false}
              />
            )}
          </div>

          <div>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14 }}>
              Your preferences
            </h2>
            <ProfileSettings profile={profile} />
          </div>
        </div>
      </div>
    </div>
  );
}
