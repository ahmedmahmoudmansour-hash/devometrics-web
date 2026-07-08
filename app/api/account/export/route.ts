import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Kept in sync with deleteMyData() in app/dashboard/actions.ts — both are
// meant to cover the same set of user-data tables. If you add a table there,
// add it here too.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [
    profile,
    plans,
    milestones,
    coachMessages,
    assessmentResults,
    gapAnalyses,
    resumeAnalyses,
    discoveryProfiles,
    bigFiveProfiles,
    coachGrowMemory,
    achievements,
    careerHealthSnapshots,
    personalTasks,
    surveyResponses,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("development_plans").select("*").eq("user_id", user.id),
    supabase
      .from("milestones")
      .select("*, development_plans!inner(user_id)")
      .eq("development_plans.user_id", user.id),
    supabase.from("coach_messages").select("*").eq("user_id", user.id),
    supabase.from("assessment_results").select("*").eq("user_id", user.id),
    supabase.from("gap_analyses").select("*").eq("user_id", user.id),
    supabase.from("resume_analyses").select("*").eq("user_id", user.id),
    supabase.from("discovery_profiles").select("*").eq("user_id", user.id),
    supabase.from("big_five_profiles").select("*").eq("user_id", user.id),
    supabase.from("coach_grow_memory").select("*").eq("user_id", user.id),
    supabase.from("user_achievements").select("*").eq("user_id", user.id),
    supabase.from("career_health_snapshots").select("*").eq("user_id", user.id),
    supabase.from("personal_tasks").select("*").eq("user_id", user.id),
    supabase.from("survey_responses").select("*").eq("user_id", user.id),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    account_email: user.email,
    profile: profile.data,
    development_plans: plans.data,
    milestones: milestones.data,
    coach_messages: coachMessages.data,
    assessment_results: assessmentResults.data,
    gap_analyses: gapAnalyses.data,
    resume_analyses: resumeAnalyses.data,
    discovery_profiles: discoveryProfiles.data,
    big_five_profiles: bigFiveProfiles.data,
    coach_grow_memory: coachGrowMemory.data,
    achievements: achievements.data,
    career_health_snapshots: careerHealthSnapshots.data,
    personal_tasks: personalTasks.data,
    survey_responses: surveyResponses.data,
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="devometrics-export-${user.id}.json"`,
    },
  });
}
