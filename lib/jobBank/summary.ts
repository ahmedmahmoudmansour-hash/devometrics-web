// What the Job bank screen needs, with readable names. Pure.
import type { CompetencyDimension } from "@/lib/gap-analysis/dimensions";
import type { BankFamily, Level } from "./types";

export type BankSummaryRole = {
  key: string;
  title: string;
  level: string;
  grade: number;
  track: "ic" | "management";
  responsibilities: string;
  requires: { name: string; level: Level; core: boolean }[];
};
export type BankSummaryFamily = { key: string; name: string; description: string; competencyCount: number; roles: BankSummaryRole[] };

export function summariseBank(bank: BankFamily[], dimensionLabel: (dimension: CompetencyDimension) => string): BankSummaryFamily[] {
  return bank.map((f) => {
    const names = new Map(f.competencies.map((c) => [c.key, c.name]));
    return {
      key: f.key,
      name: f.name,
      description: f.description,
      competencyCount: f.competencies.length,
      roles: [...f.roles]
        .sort((a, b) => a.grade - b.grade || a.title.localeCompare(b.title))
        .map((r) => ({
          key: r.key,
          title: r.title,
          level: r.level,
          grade: r.grade,
          track: r.track,
          responsibilities: r.responsibilities,
          requires: [
            ...Object.entries(r.technical).map(([key, level]) => ({ name: names.get(key) ?? key, level, core: false })),
            ...Object.entries(r.standard).map(([dim, level]) => ({ name: dimensionLabel(dim as CompetencyDimension), level: level as Level, core: true })),
          ],
        })),
    };
  });
}
