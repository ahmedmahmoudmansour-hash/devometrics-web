"use client";

import { useTranslations } from "next-intl";
import { ACCOMMODATIONS, ACCOMMODATION_DESCRIPTIONS } from "@/lib/gap-analysis/accommodations";
import { RESOURCE_TIERS } from "@/lib/gap-analysis/freeResources";
import { LEARNING_FORMATS, LEARNING_FORMAT_DESCRIPTIONS } from "@/lib/gap-analysis/actionLibrary";

export const CAREER_STAGES = [
  "Student",
  "Job seeker",
  "Early-career professional",
  "Professional",
  "Manager",
  "Executive",
  "Career changer",
  "Entrepreneur / Freelancer",
];

export type PersonalizationValues = {
  location: string;
  learningPreferences: string[];
  careerStage: string;
  accommodation: string;
  resourceTier: string;
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 14,
  color: "var(--text)",
  outline: "none",
};

const RESOURCE_TIER_HINT: Record<(typeof RESOURCE_TIERS)[number], string> = {
  "Premium resources":
    "Real prices vary a lot by format — roughly free–$20/mo for reading, $30–60 for a course certificate, $75–300/mo for mentorship, $200–1,500 per cohort program.",
  "Budget-conscious mix":
    "Mixes free resources with occasional low-cost paid options, but steers away from expensive mentorship or cohort programs — free community alternatives get suggested for those instead.",
  "Free & open resources only":
    "Your plan will point to free, open resources (open courseware, curated free platforms, your public library) instead of assuming paid courses.",
};

// The one source for "everything about how I want to learn and what I can
// afford" — used on Profile Settings (the full editor) and inline on every
// plan-creation entry point (dashboard quick-plan, Assessments), so the
// fields and their exact wording never drift between the three surfaces.
export default function PersonalizationFields({
  value,
  onChange,
  showCareerStage = true,
}: {
  value: PersonalizationValues;
  onChange: (next: PersonalizationValues) => void;
  showCareerStage?: boolean;
}) {
  const t = useTranslations("personalizationFields");
  function set<K extends keyof PersonalizationValues>(key: K, val: PersonalizationValues[K]) {
    onChange({ ...value, [key]: val });
  }

  function toggleLearningPreference(format: string) {
    set(
      "learningPreferences",
      value.learningPreferences.includes(format)
        ? value.learningPreferences.filter((f) => f !== format)
        : [...value.learningPreferences, format]
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {showCareerStage && (
        <div>
          <label htmlFor="career-stage" style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
            {t("careerStageLabel")}
          </label>
          <select
            id="career-stage"
            value={value.careerStage}
            onChange={(e) => set("careerStage", e.target.value)}
            style={selectStyle}
          >
            <option value="" style={{ color: "#000" }}>
              {t("selectStage")}
            </option>
            {CAREER_STAGES.map((s) => (
              <option key={s} value={s} style={{ color: "#000" }}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label htmlFor="location" style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
          {t("locationLabel")}
        </label>
        <input
          id="location"
          type="text"
          value={value.location}
          onChange={(e) => set("location", e.target.value)}
          placeholder={t("locationPlaceholder")}
          style={selectStyle}
        />
      </div>

      <div>
        <label style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
          {t("learningPreferencesLabel")}
        </label>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, lineHeight: 1.5 }}>
          {t("learningPreferencesHint")}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {LEARNING_FORMATS.map((format) => {
            const checked = value.learningPreferences.includes(format);
            return (
              <button
                key={format}
                type="button"
                onClick={() => toggleLearningPreference(format)}
                aria-pressed={checked}
                title={LEARNING_FORMAT_DESCRIPTIONS[format]}
                style={{
                  padding: "8px 14px",
                  borderRadius: 100,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: checked ? "1px solid rgba(0,201,167,0.4)" : "1px solid var(--border)",
                  background: checked ? "rgba(0,201,167,0.12)" : "rgba(255,255,255,0.05)",
                  color: checked ? "var(--teal)" : "var(--text-muted)",
                }}
              >
                {format}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor="accommodation" style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
          {t("accommodationLabel")}
        </label>
        <select
          id="accommodation"
          value={value.accommodation}
          onChange={(e) => set("accommodation", e.target.value)}
          style={selectStyle}
        >
          {ACCOMMODATIONS.map((a) => (
            <option key={a} value={a} style={{ color: "#000" }}>
              {a}
            </option>
          ))}
        </select>
        {value.accommodation && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
            {ACCOMMODATION_DESCRIPTIONS[value.accommodation as keyof typeof ACCOMMODATION_DESCRIPTIONS]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="resource-tier" style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
          {t("resourceTierLabel")}
        </label>
        <select
          id="resource-tier"
          value={value.resourceTier}
          onChange={(e) => set("resourceTier", e.target.value)}
          style={selectStyle}
        >
          <option value="" style={{ color: "#000" }}>
            {t("selectBudget")}
          </option>
          {RESOURCE_TIERS.map((t) => (
            <option key={t} value={t} style={{ color: "#000" }}>
              {t}
            </option>
          ))}
        </select>
        {value.resourceTier && (
          <p
            style={{
              fontSize: 12,
              color: value.resourceTier === "Free & open resources only" ? "var(--teal)" : "var(--text-muted)",
              marginTop: 6,
              lineHeight: 1.5,
            }}
          >
            {RESOURCE_TIER_HINT[value.resourceTier as keyof typeof RESOURCE_TIER_HINT]}
          </p>
        )}
      </div>
    </div>
  );
}
