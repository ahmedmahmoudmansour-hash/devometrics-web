import type { ScoreEvent, ScoreEventScale, ScoreEventSource } from "./scoreEvents";

// Deterministic, rule-based trend detection over an employee's score
// history — no model call, instant, zero cost. Returns structured facts
// only (never a pre-rendered sentence): this codebase translates every
// user-facing string through messages/en.json + ar.json, so the component
// consuming this formats the actual sentence via useTranslations with
// interpolation, the same way every other dynamic string in this app works.
// A genuinely AI-written narrative synthesis is the named Phase 4 upgrade,
// not built here.

export type TrendDirection = "improving" | "stable" | "declining";

export type TrendSignal = {
  source: ScoreEventSource;
  dimension: string;
  direction: TrendDirection;
  previousValue: number;
  latestValue: number;
  scale: ScoreEventScale;
  // How many data points this source/dimension has in total — feeds "over
  // N cycles" phrasing at the UI layer.
  cycleCount: number;
};

// Deadband per scale — a 1-point wobble on a 0-100 assessment or a 0.1
// wobble on a 1-5 rating shouldn't read as a real trend. Tuned to be a
// meaningful move, not noise.
const DEADBAND: Record<ScoreEventScale, number> = { "0_100": 3, "1_5": 0.2 };

export function summarizeEmployeeTrend(history: ScoreEvent[]): TrendSignal[] {
  const groups = new Map<string, ScoreEvent[]>();
  for (const event of history) {
    const key = `${event.source}::${event.dimension}`;
    const list = groups.get(key) ?? [];
    list.push(event);
    groups.set(key, list);
  }

  const signals: TrendSignal[] = [];
  for (const events of groups.values()) {
    if (events.length < 2) continue; // no premature trend claim off a single data point
    const sorted = [...events].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
    const previous = sorted[sorted.length - 2];
    const latest = sorted[sorted.length - 1];
    const delta = latest.rawValue - previous.rawValue;
    const deadband = DEADBAND[latest.scale];
    const direction: TrendDirection = delta > deadband ? "improving" : delta < -deadband ? "declining" : "stable";
    signals.push({
      source: latest.source,
      dimension: latest.dimension,
      direction,
      previousValue: previous.rawValue,
      latestValue: latest.rawValue,
      scale: latest.scale,
      cycleCount: sorted.length,
    });
  }

  // Non-stable signals lead — those are the ones actually worth a person's
  // attention at the top of the timeline.
  return signals.sort((a, b) => {
    if (a.direction === "stable" && b.direction !== "stable") return 1;
    if (a.direction !== "stable" && b.direction === "stable") return -1;
    return 0;
  });
}
