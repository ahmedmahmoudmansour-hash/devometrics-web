"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "@/app/dashboard/actions";
import { ACCOMMODATIONS, ACCOMMODATION_DESCRIPTIONS } from "@/lib/gap-analysis/accommodations";
import { RESOURCE_TIERS } from "@/lib/gap-analysis/freeResources";
import { LEARNING_FORMATS, LEARNING_FORMAT_DESCRIPTIONS } from "@/lib/gap-analysis/actionLibrary";
import type { Profile } from "@/lib/supabase/types";

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

export default function ProfileSettings({ profile }: { profile: Profile | null }) {
  const [location, setLocation] = useState(profile?.location ?? "");
  const [learningPreferences, setLearningPreferences] = useState<string[]>(
    profile?.learning_preferences ?? []
  );
  const [careerStage, setCareerStage] = useState(profile?.career_stage ?? "");
  const [accommodation, setAccommodation] = useState(profile?.accommodation ?? "");
  const [resourceTier, setResourceTier] = useState(profile?.resource_tier ?? "");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function toggleLearningPreference(format: string) {
    setLearningPreferences((prev) =>
      prev.includes(format) ? prev.filter((f) => f !== format) : [...prev, format]
    );
    setSaved(false);
  }

  return (
    <div
      style={{
        background: "var(--navy-mid)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: 28,
      }}
    >
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
        Personalize your plans &amp; coach
      </h2>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
        This drives more than the chat — your Development Plans, Assessment plans, and
        AI Coach all use where you are in your career, how you actually like to learn,
        and what budget you&apos;re working with. All fields here are optional and
        self-disclosed. You can also set your learning preference inline the next time
        you generate a plan.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(() => {
            updateProfile(location, learningPreferences, careerStage, accommodation, resourceTier);
          });
          setSaved(true);
        }}
        style={{ display: "flex", flexDirection: "column", gap: 20 }}
      >
        <div>
          <label htmlFor="career-stage" style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
            Career stage
          </label>
          <select
            id="career-stage"
            value={careerStage}
            onChange={(e) => {
              setCareerStage(e.target.value);
              setSaved(false);
            }}
            style={selectStyle}
          >
            <option value="" style={{ color: "#000" }}>
              Select your stage
            </option>
            {CAREER_STAGES.map((s) => (
              <option key={s} value={s} style={{ color: "#000" }}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="location" style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
            Location
          </label>
          <input
            id="location"
            type="text"
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              setSaved(false);
            }}
            placeholder="e.g. Dubai, UAE"
            style={selectStyle}
          />
        </div>

        <div>
          <label style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
            Learning preferences
          </label>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, lineHeight: 1.5 }}>
            Pick as many as apply — plans will mix between the formats you choose.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {LEARNING_FORMATS.map((format) => {
              const checked = learningPreferences.includes(format);
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
            How you process information
          </label>
          <select
            id="accommodation"
            value={accommodation}
            onChange={(e) => {
              setAccommodation(e.target.value);
              setSaved(false);
            }}
            style={selectStyle}
          >
            {ACCOMMODATIONS.map((a) => (
              <option key={a} value={a} style={{ color: "#000" }}>
                {a}
              </option>
            ))}
          </select>
          {accommodation && (
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
              {ACCOMMODATION_DESCRIPTIONS[accommodation as keyof typeof ACCOMMODATION_DESCRIPTIONS]}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="resource-tier" style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
            Resource budget
          </label>
          <select
            id="resource-tier"
            value={resourceTier}
            onChange={(e) => {
              setResourceTier(e.target.value);
              setSaved(false);
            }}
            style={selectStyle}
          >
            <option value="" style={{ color: "#000" }}>
              Select a budget
            </option>
            {RESOURCE_TIERS.map((t) => (
              <option key={t} value={t} style={{ color: "#000" }}>
                {t}
              </option>
            ))}
          </select>
          {resourceTier && (
            <p
              style={{
                fontSize: 12,
                color: resourceTier === "Free & open resources only" ? "var(--teal)" : "var(--text-muted)",
                marginTop: 6,
                lineHeight: 1.5,
              }}
            >
              {RESOURCE_TIER_HINT[resourceTier as keyof typeof RESOURCE_TIER_HINT]}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isPending}
          style={{
            alignSelf: "flex-start",
            background: saved ? "rgba(0,201,167,0.1)" : "var(--teal)",
            color: saved ? "var(--teal)" : "#0A0F1E",
            border: saved ? "1px solid rgba(0,201,167,0.3)" : "none",
            borderRadius: 8,
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {saved ? "Saved" : "Save"}
        </button>
      </form>
    </div>
  );
}
