// The job bank: ready-made starter job families, with the technical and functional competencies each family needs
// (five written levels each) and roles that require them at a stated level. Plain data and plain functions: no database,
// no AI. A company adds what it wants to its own Job Architecture (see actions.ts) and can then edit it freely.
//
// STATUS OF THE CONTENT: drafted with AI and checked only for consistency by tests. Not reviewed by subject experts and
// not validated against real performance. It is a starting point for a company's own people to adapt, never a standard.

import type { CompetencyDimension } from "@/lib/gap-analysis/dimensions";
import type { CompetencyCategory } from "@/lib/proficiency/library";

export type Level = 1 | 2 | 3 | 4 | 5;
export type LevelTexts = [string, string, string, string, string];

export type BankCompetency = {
  // Stable id inside the bank, for example "hr.recruitment".
  key: string;
  name: string;
  category: CompetencyCategory;
  description: string;
  // What each of the five levels looks like, level 1 first.
  levels: LevelTexts;
};

export type BankRole = {
  key: string;
  title: string;
  // Display label of the ladder step: Entry, Mid, Senior, Lead, Manager, Head.
  level: string;
  grade: number; // 1 to 10
  track: "ic" | "management";
  responsibilities: string;
  // Bank competency key -> level the role needs (1 to 5).
  technical: Record<string, Level>;
  // Standard dimension -> level the role needs (1 to 5).
  standard: Partial<Record<CompetencyDimension, Level>>;
};

export type BankFamily = {
  key: string;
  name: string;
  description: string;
  competencies: BankCompetency[];
  roles: BankRole[];
};
