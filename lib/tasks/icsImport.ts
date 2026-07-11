export type ParsedICSEvent = {
  title: string;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM, null for all-day events
};

function unescapeICSText(s: string): string {
  return s.replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

// ICS "folds" long lines by breaking them and continuing on the next line
// with a leading space/tab — has to be undone before parsing, or a long
// SUMMARY silently gets truncated at the fold point.
function unfoldLines(text: string): string[] {
  const rawLines = text.split(/\r\n|\n|\r/);
  const lines: string[] = [];
  for (const line of rawLines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

// Handles both all-day (20260714) and timed (20260714T090000Z or
// ...T090000 local) DTSTART values. Doesn't attempt real timezone
// conversion for TZID-qualified values — takes the wall-clock time as
// written, which matches how the value reads in whatever calendar exported
// it closely enough for a one-time import.
function parseDateTimeValue(value: string): { date: string; time: string | null } | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  return { date: `${y}-${mo}-${d}`, time: h && mi ? `${h}:${mi}` : null };
}

export function parseICS(icsText: string, maxEvents: number): ParsedICSEvent[] {
  const lines = unfoldLines(icsText);
  const events: ParsedICSEvent[] = [];
  let inEvent = false;
  let summary: string | null = null;
  let dtstartRaw: string | null = null;

  for (const line of lines) {
    if (/^BEGIN:VEVENT/i.test(line)) {
      inEvent = true;
      summary = null;
      dtstartRaw = null;
      continue;
    }
    if (/^END:VEVENT/i.test(line)) {
      if (inEvent && dtstartRaw) {
        const parsed = parseDateTimeValue(dtstartRaw);
        if (parsed) {
          events.push({
            title: (summary ? unescapeICSText(summary) : "Untitled event").slice(0, 200),
            date: parsed.date,
            time: parsed.time,
          });
        }
      }
      inEvent = false;
      if (events.length >= maxEvents) break;
      continue;
    }
    if (!inEvent) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const keyName = line.slice(0, colonIdx).split(";")[0].toUpperCase();
    const value = line.slice(colonIdx + 1);

    if (keyName === "SUMMARY") summary = value;
    else if (keyName === "DTSTART") dtstartRaw = value;
  }

  return events;
}
