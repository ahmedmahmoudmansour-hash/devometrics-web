import type { CompetencyDimension } from "@/lib/gap-analysis/dimensions";
import { COMPETENCY_DIMENSIONS } from "@/lib/gap-analysis/dimensions";
import {
  LayoutList,
  Grid3x3,
  TrendingUp,
  Triangle,
  Network,
  Star,
  ClipboardList,
  SlidersHorizontal,
  MessageSquare,
  Award,
  Palette,
  ShieldCheck,
  ClipboardCheck,
  GitBranch,
  IdCard,
} from "lucide-react";

// Shared between the /enterprise/capabilities and /enterprise/live-demo
// pages (each now its own route, was a single page.tsx before the enterprise
// section was split into real pages for URL-level consistency with the
// individual homepage's tab structure).
export const CAPABILITY_ICONS: React.ComponentType<{ size?: number }>[] = [
  Network,
  GitBranch,
  ClipboardCheck,
  IdCard,
  LayoutList,
  Grid3x3,
  Star,
  TrendingUp,
  Triangle,
  ClipboardList,
  SlidersHorizontal,
  MessageSquare,
  Award,
  Palette,
  ShieldCheck,
];

// Fictional workspace used purely to illustrate the shape of the real
// Talent Heatmap + Capability Pyramid — the components below are the exact
// ones every real workspace renders, just fed made-up data instead of a
// live buildCompanyData() query.
export const SAMPLE_ROWS_LEVELS: { name: string; levels: Partial<Record<CompetencyDimension, number>> }[] = [
  {
    name: "Amara Osei",
    levels: {
      "Technical Skills": 72,
      Leadership: 58,
      "Strategic Thinking": 65,
      Communication: 80,
      "AI & Digital Skills": 70,
      "Critical Thinking": 75,
      "People Management": 55,
      "Financial Literacy": 48,
    },
  },
  {
    name: "Priya Kapoor",
    levels: {
      "Technical Skills": 88,
      Leadership: 74,
      "Strategic Thinking": 60,
      Communication: 68,
      "AI & Digital Skills": 82,
      "Critical Thinking": 78,
      "People Management": 70,
      "Financial Literacy": 40,
    },
  },
  {
    name: "Daniel Mensah",
    levels: {
      "Technical Skills": 65,
      Leadership: 35,
      "Strategic Thinking": 50,
      Communication: 60,
      "AI & Digital Skills": 74,
      "Critical Thinking": 68,
      "People Management": 30,
      "Financial Literacy": 55,
    },
  },
];

export const SAMPLE_AVERAGES: Partial<Record<CompetencyDimension, number>> = Object.fromEntries(
  COMPETENCY_DIMENSIONS.map((d) => {
    const values = SAMPLE_ROWS_LEVELS.map((r) => r.levels[d]).filter((v): v is number => v !== undefined);
    return [d, Math.round(values.reduce((a, b) => a + b, 0) / values.length)];
  })
);

export const sampleCellStyle: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: 13,
  borderBottom: "1px solid var(--border)",
  color: "var(--text)",
};
export const sampleHeadStyle: React.CSSProperties = {
  ...sampleCellStyle,
  color: "var(--text-muted)",
  fontWeight: 700,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  borderBottom: "1px solid var(--border)",
};
