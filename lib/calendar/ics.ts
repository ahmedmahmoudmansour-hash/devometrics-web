// Minimal RFC 5545 (iCalendar) generation — no library dependency, since the
// app only ever needs two simple event shapes (a one-off all-day reminder,
// and a simple recurring check-in). Text fields must escape backslash,
// semicolon, comma, and newline per the spec, or common calendar clients
// (Google/Outlook/Apple) will mis-parse the file.
function escapeICSText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function stampUTC(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function foldLines(lines: (string | undefined)[]): string {
  return lines.filter((l): l is string => Boolean(l)).join("\r\n");
}

// One-off all-day reminder tied to a single milestone's target date.
export function buildMilestoneICS(params: { uid: string; title: string; description?: string; date: string }): string {
  const dtValue = params.date.replace(/-/g, "");
  return foldLines([
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Devometrics//Coach Reminders//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${params.uid}@devometrics.app`,
    `DTSTAMP:${stampUTC(new Date())}`,
    `DTSTART;VALUE=DATE:${dtValue}`,
    `SUMMARY:${escapeICSText(params.title)}`,
    params.description ? `DESCRIPTION:${escapeICSText(params.description)}` : undefined,
    "END:VEVENT",
    "END:VCALENDAR",
  ]);
}

// Personal task → calendar event. Works with Outlook, Google, and Apple
// Calendar today via plain .ics download/import — no OAuth, no Azure App
// Registration, no token refresh to maintain. A true two-way Outlook sync
// (auto-updating as tasks change) would need Microsoft Graph OAuth, which is
// a much bigger, separate project — this covers "get it on my calendar"
// without that overhead.
export type TaskRecurringFreq = "DAILY" | "WEEKLY" | "MONTHLY";

export function buildTaskICS(params: {
  uid: string;
  title: string;
  startAt: Date;
  recurring?: TaskRecurringFreq;
  weekdaysOnly?: boolean;
}): string {
  const rrule = params.recurring
    ? params.recurring === "DAILY" && params.weekdaysOnly
      ? "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
      : `FREQ=${params.recurring}`
    : undefined;
  return foldLines([
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Devometrics//Task Reminders//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${params.uid}@devometrics.app`,
    `DTSTAMP:${stampUTC(new Date())}`,
    `DTSTART:${stampUTC(params.startAt)}`,
    `DURATION:PT30M`,
    rrule ? `RRULE:${rrule}` : undefined,
    `SUMMARY:${escapeICSText(params.title)}`,
    "DESCRIPTION:From your Devometrics daily tasks — private to you.",
    "END:VEVENT",
    "END:VCALENDAR",
  ]);
}

export type CheckinFrequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY";

// Recurring "check in with your AI Coach" reminder, so progress reviews
// happen on a cadence instead of only when the user remembers to open the
// app. BIWEEKLY isn't a native RRULE FREQ value — it's WEEKLY with
// INTERVAL=2, which is the standard way every calendar client expresses it.
// startAt is an actual instant (already resolved from whatever local
// date/time the user picked in their own timezone, client-side) — emitting
// it as UTC (trailing Z) means every calendar client shows it correctly
// converted to the viewer's own timezone, without needing a VTIMEZONE block.
// sessionCount is optional — omitting it means "repeat indefinitely," same
// as before; setting it adds RRULE's COUNT so the series actually ends
// after that many check-ins instead of running forever.
export function buildCoachCheckinICS(params: { uid: string; startAt: Date; frequency: CheckinFrequency; sessionCount?: number }): string {
  const baseRrule = params.frequency === "BIWEEKLY" ? "FREQ=WEEKLY;INTERVAL=2" : `FREQ=${params.frequency}`;
  const rrule = params.sessionCount && params.sessionCount > 0 ? `${baseRrule};COUNT=${params.sessionCount}` : baseRrule;
  return foldLines([
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Devometrics//Coach Reminders//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${params.uid}@devometrics.app`,
    `DTSTAMP:${stampUTC(new Date())}`,
    `DTSTART:${stampUTC(params.startAt)}`,
    `DURATION:PT30M`,
    `RRULE:${rrule}`,
    "SUMMARY:Devometrics AI Coach check-in",
    "DESCRIPTION:Time to check in with your AI Career Coach on your development plan progress.",
    "END:VEVENT",
    "END:VCALENDAR",
  ]);
}
