import { dimensionLabel } from "@/lib/gap-analysis/dimensions";
import type { AttentionFlag } from "./companyOverview";

type Translator = (key: string, values?: Record<string, string | number>) => string;

// Each AttentionFlag carries a stable key + structured params, not a
// pre-built English sentence (see companyOverview.ts) — this is the one
// place that turns it into localized copy, shared by every page that
// renders the attention list (company profile, the analytics dashboard)
// so they can never quietly drift out of sync with each other.
//
// `t` must be getTranslations("companyProfilePage") specifically — that's
// where every attention* key lives, regardless of which page is calling
// this (the analytics dashboard doesn't get its own copy of these keys).
export function attentionFlagText(t: Translator, tDim: Translator, flag: AttentionFlag): string {
  switch (flag.key) {
    case "lowDimension":
      return t("attentionLowDimension", { dimension: dimensionLabel(tDim, flag.dimension), score: flag.score });
    case "noManager":
      return t("attentionNoManager", { count: flag.count, total: flag.total });
    case "lowSurveyParticipation":
      return t("attentionLowSurveyParticipation", {
        title: flag.title,
        percent: flag.percent,
        responses: flag.responses,
        assigned: flag.assigned,
      });
    case "noSuccessor":
      return t("attentionNoSuccessor", { count: flag.count, total: flag.total });
    case "openPostingsNoCandidates":
      return t("attentionOpenPostingsNoCandidates", { count: flag.count });
    case "highFlightRisk":
      return t("attentionHighFlightRisk", { name: flag.name, score: flag.score });
    case "exitInterviewInsight":
      return t("attentionExitInterviewInsight", { summary: flag.summary });
    case "exitInterviewTrendsReady":
      return t("attentionExitInterviewTrendsReady", { count: flag.count });
  }
}
