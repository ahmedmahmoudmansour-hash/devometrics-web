import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildCoachCheckinICS, type CheckinFrequency } from "@/lib/calendar/ics";

const VALID_FREQUENCIES: CheckinFrequency[] = ["WEEKLY", "BIWEEKLY", "MONTHLY"];

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const frequencyParam = (searchParams.get("frequency") ?? "WEEKLY").toUpperCase();
  const frequency = VALID_FREQUENCIES.includes(frequencyParam as CheckinFrequency)
    ? (frequencyParam as CheckinFrequency)
    : "WEEKLY";

  // "start" is a full ISO instant, already converted from whatever local
  // date/time the user picked in their own browser timezone — falls back to
  // "now" only if the client didn't send one (shouldn't normally happen).
  const startParam = searchParams.get("start");
  const startAt = startParam && !Number.isNaN(Date.parse(startParam)) ? new Date(startParam) : new Date();

  // "sessions" is optional — omitted or 0 means repeat indefinitely, same as
  // the original behavior. A parsed value between 1 and 52 caps the series.
  const sessionsParam = Number(searchParams.get("sessions"));
  const sessionCount = Number.isInteger(sessionsParam) && sessionsParam > 0 && sessionsParam <= 52 ? sessionsParam : undefined;

  const ics = buildCoachCheckinICS({
    uid: `coach-checkin-${user.id}-${Date.now()}`,
    startAt,
    frequency,
    sessionCount,
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="coach-checkin.ics"`,
    },
  });
}
