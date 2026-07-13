import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Triggered daily by Vercel Cron (vercel.json). Same auth pattern as
// /api/cron/task-reminders — Vercel sends "Authorization: Bearer
// $CRON_SECRET" automatically for cron-triggered requests when an env var
// of that exact name is set. That header check stops random callers from
// hitting this route; the real data-safety boundary is the secret check
// inside each SQL function itself (see migration 0059's comment on why —
// same reasoning as due_task_reminders).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  const [{ data: orgsPurged, error: orgError }, { data: dataPurged, error: dataError }] = await Promise.all([
    supabase.rpc("purge_scheduled_organization_deletions", { secret }),
    supabase.rpc("purge_scheduled_data_deletions", { secret }),
  ]);

  if (orgError) console.error("purge_scheduled_organization_deletions failed:", orgError);
  if (dataError) console.error("purge_scheduled_data_deletions failed:", dataError);

  return NextResponse.json({
    organizationsPurged: orgsPurged ?? 0,
    profilesPurged: dataPurged ?? 0,
  });
}
