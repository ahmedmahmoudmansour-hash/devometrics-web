// Shared 9-box zone definitions — pure data, no React/client dependency, so
// it can be imported by both plain server-side utilities (nineBox.ts, used
// from many Server Component pages) and client components (charts.tsx)
// without crossing the "use client" boundary: a client-only file's non-
// component exports (arrays, functions, constants) cannot be safely
// imported into Server Component code, only its component exports can.
export const NINE_BOX_ZONES: { row: 0 | 1 | 2; col: 0 | 1 | 2; label: string; needs: string; tone: "teal" | "amber" | "danger" | "muted" }[] = [
  { row: 2, col: 0, label: "High Potential", needs: "Fast-track development and sponsorship — capability is behind, but growth signal is strong.", tone: "amber" },
  { row: 2, col: 1, label: "Future Star", needs: "Accelerated growth plan and visibility — keep them engaged and challenged.", tone: "teal" },
  { row: 2, col: 2, label: "Future Leader", needs: "Succession-ready. Retain deliberately and prepare for the transition.", tone: "teal" },
  { row: 1, col: 0, label: "Rough Diamond", needs: "Structured coaching and foundational skill-building before stretching further.", tone: "amber" },
  { row: 1, col: 1, label: "Core Player", needs: "Steady development and broader exposure — the dependable middle of the org.", tone: "muted" },
  { row: 1, col: 2, label: "Trusted Professional", needs: "Stretch assignments and more visibility so capability keeps compounding.", tone: "teal" },
  { row: 0, col: 0, label: "Needs Attention", needs: "Address directly — closer coaching, a performance plan, or a role that fits better.", tone: "danger" },
  { row: 0, col: 1, label: "Inconsistent", needs: "Closer management and fundamentals — capability is present but growth has stalled.", tone: "amber" },
  { row: 0, col: 2, label: "Plateaued", needs: "New challenges to reignite growth — capable but at risk of disengaging.", tone: "muted" },
];

// Zone `label` stays the stable English identifier used for keying/lookup
// throughout the codebase (high-potential/page.tsx's ZONE_ORDER + byZone Map,
// SuccessionBoard.tsx) — the zone NAME itself is deliberately left
// untranslated (jargon closer to "OKR" than to prose; "Rough Diamond" loses
// its idiom in Arabic). Only the "needs" explanation is translated.
export const ZONE_TRANSLATION_KEY: Record<string, string> = {
  "High Potential": "highPotential",
  "Future Star": "futureStar",
  "Future Leader": "futureLeader",
  "Rough Diamond": "roughDiamond",
  "Core Player": "corePlayer",
  "Trusted Professional": "trustedProfessional",
  "Needs Attention": "needsAttention",
  Inconsistent: "inconsistent",
  Plateaued: "plateaued",
};

export function zoneNeeds(t: (key: string) => string, label: string): string {
  return t(`${ZONE_TRANSLATION_KEY[label]}.needs`);
}
