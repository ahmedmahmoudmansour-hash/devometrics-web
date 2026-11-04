// Small constructors that keep the family files short and readable.
import type { CompetencyDimension } from "@/lib/gap-analysis/dimensions";
import type { CompetencyCategory } from "@/lib/proficiency/library";
import type { BankCompetency, BankFamily, BankRole, Level, LevelTexts } from "./types";

export function comp(key: string, name: string, category: CompetencyCategory, description: string, levels: LevelTexts): BankCompetency {
  return { key, name, category, description, levels };
}

export function role(
  key: string,
  title: string,
  level: string,
  grade: number,
  track: "ic" | "management",
  responsibilities: string,
  technical: Record<string, Level>,
  standard: Partial<Record<CompetencyDimension, Level>>
): BankRole {
  return { key, title, level, grade, track, responsibilities, technical, standard };
}

export function family(key: string, name: string, description: string, competencies: BankCompetency[], roles: BankRole[]): BankFamily {
  return { key, name, description, competencies, roles };
}
