import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type FeedTask = { id: string; title: string; date: string; time: string | null; completed: boolean };
type FeedMilestone = { id: string; title: string; date: string; completed: boolean };

function escapeICS(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function dateDigits(date: string): string {
  return date.replaceAll("-", "");
}

// Subscription feed for Outlook/Google/Apple Calendar — the user's tasks
// and milestone deadlines as a live, auto-refreshing calendar. Fetched by
// the calendar provider's servers with NO session: authentication is the
// long random per-user token, checked inside the security-definer
// calendar_feed function (migration 0050). Different from the one-shot
// .ics downloads in the sibling routes, which are single-event attachments.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("t");
  if (!token || token.length < 32) {
    return NextResponse.json({ error: "Invalid feed URL" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("calendar_feed", { feed_token: token });
  if (error || !data) {
    return NextResponse.json({ error: "Feed not found" }, { status: 404 });
  }

  const tasks = (data.tasks ?? []) as FeedTask[];
  const milestones = (data.milestones ?? []) as FeedMilestone[];
  const now = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";

  const events: string[] = [];
  for (const t of tasks) {
    const lines = ["BEGIN:VEVENT", `UID:devometrics-task-${t.id}`, `DTSTAMP:${now}`];
    if (t.time) {
      // Floating local time (no TZID/Z suffix) — renders at the user's own
      // wall-clock time wherever the calendar is viewed, matching how the
      // time was entered.
      const timeDigits = t.time.slice(0, 5).replace(":", "") + "00";
      lines.push(`DTSTART:${dateDigits(t.date)}T${timeDigits}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${dateDigits(t.date)}`);
    }
    lines.push(`SUMMARY:${escapeICS(`${t.completed ? "✓ " : ""}${t.title}`)}`);
    lines.push("END:VEVENT");
    events.push(lines.join("\r\n"));
  }
  for (const m of milestones) {
    events.push(
      [
        "BEGIN:VEVENT",
        `UID:devometrics-milestone-${m.id}`,
        `DTSTAMP:${now}`,
        `DTSTART;VALUE=DATE:${dateDigits(m.date)}`,
        `SUMMARY:${escapeICS(`🏁 Milestone due: ${m.title}`)}`,
        "END:VEVENT",
      ].join("\r\n")
    );
  }

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Devometrics//Calendar Feed//EN",
    "X-WR-CALNAME:Devometrics",
    "X-PUBLISHED-TTL:PT1H",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=900",
    },
  });
}
