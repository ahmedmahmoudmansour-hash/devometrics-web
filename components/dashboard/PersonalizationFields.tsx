"use client";

import { useTranslations } from "next-intl";
import { ACCOMMODATIONS } from "@/lib/gap-analysis/accommodations";
import { RESOURCE_TIERS } from "@/lib/gap-analysis/freeResources";
import { LEARNING_FORMATS } from "@/lib/gap-analysis/actionLibrary";

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

// Every option below is stored in the database (and read by other code and
// AI prompts) as its stable English identifier — only the on-screen label is
// translated. These maps translate the identifier from lib/gap-analysis/* to
// the matching key under the "personalizationOptions" namespace, the same
// "stable English value, translated display label" pattern used elsewhere.
const CAREER_STAGE_KEYS: Record<string, string> = {
  Student: "student",
  "Job seeker": "jobSeeker",
  "Early-career professional": "earlyCareerProfessional",
  Professional: "professional",
  Manager: "manager",
  Executive: "executive",
  "Career changer": "careerChanger",
  "Entrepreneur / Freelancer": "entrepreneurFreelancer",
};

const ACCOMMODATION_KEYS: Record<string, string> = {
  Standard: "standard",
  "Bite-sized & low-distraction": "biteSizedLowDistraction",
  "Audio/video-first": "audioVideoFirst",
  "Structured & predictable": "structuredPredictable",
};

const RESOURCE_TIER_KEYS: Record<string, string> = {
  "Premium resources": "premium",
  "Budget-conscious mix": "budgetConsciousMix",
  "Free & open resources only": "freeOpenOnly",
};

const LEARNING_FORMAT_KEYS: Record<string, string> = {
  "Reading & self-study": "readingSelfStudy",
  "Research & case studies": "researchCaseStudies",
  "Video courses": "videoCourses",
  "Short courses & workshops": "shortCoursesWorkshops",
  "Professional certifications": "professionalCertifications",
  "Webinars & virtual events": "webinarsVirtualEvents",
  "Hands-on projects": "handsOnProjects",
  "Mentorship & coaching": "mentorshipCoaching",
  "Peer learning": "peerLearning",
  "Live cohort classes": "liveCohortClasses",
};

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
  const tOptions = useTranslations("personalizationOptions");
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
                {tOptions(`careerStage.${CAREER_STAGE_KEYS[s]}`)}
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
                title={tOptions(`learningFormatDescription.${LEARNING_FORMAT_KEYS[format]}`)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 100,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: checked ? "1px solid rgba(var(--teal-rgb),0.4)" : "1px solid var(--border)",
                  background: checked ? "rgba(var(--teal-rgb),0.12)" : "rgba(255,255,255,0.05)",
                  color: checked ? "var(--teal)" : "var(--text-muted)",
                }}
              >
                {tOptions(`learningFormatName.${LEARNING_FORMAT_KEYS[format]}`)}
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
              {tOptions(`accommodationName.${ACCOMMODATION_KEYS[a]}`)}
            </option>
          ))}
        </select>
        {value.accommodation && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
            {tOptions(`accommodationDescription.${ACCOMMODATION_KEYS[value.accommodation]}`)}
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
          {RESOURCE_TIERS.map((tier) => (
            <option key={tier} value={tier} style={{ color: "#000" }}>
              {tOptions(`resourceTierName.${RESOURCE_TIER_KEYS[tier]}`)}
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
            {tOptions(`resourceTierHint.${RESOURCE_TIER_KEYS[value.resourceTier]}`)}
          </p>
        )}
      </div>
    </div>
  );
}
