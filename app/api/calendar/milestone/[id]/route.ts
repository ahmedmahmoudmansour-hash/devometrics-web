import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildMilestoneICS } from "@/lib/calendar/ics";
import type { Milestone } from "@/lib/supabase/types";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Relies on the existing milestone RLS policies (owner, or org admin of the
  // owner) — no extra authorization logic needed here.
  const { data: milestone } = await supabase
    .from("milestones")
    .select("*")
    .eq("id", id)
    .single<Milestone>();
  if (!milestone) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!milestone.target_date) {
    return NextResponse.json({ error: "This task has no target date to remind you about" }, { status: 400 });
  }

  const ics = buildMilestoneICS({
    uid: milestone.id,
    title: milestone.title,
    description: milestone.description ?? undefined,
    date: milestone.target_date,
  });

  const safeName = milestone.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "task";

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}.ics"`,
    },
  });
}
