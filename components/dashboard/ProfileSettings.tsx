"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "@/app/dashboard/actions";
import PersonalizationFields, { type PersonalizationValues } from "@/components/dashboard/PersonalizationFields";
import type { Profile } from "@/lib/supabase/types";

export default function ProfileSettings({ profile }: { profile: Profile | null }) {
  const [values, setValues] = useState<PersonalizationValues>({
    location: profile?.location ?? "",
    learningPreferences: profile?.learning_preferences ?? [],
    careerStage: profile?.career_stage ?? "",
    accommodation: profile?.accommodation ?? "",
    resourceTier: profile?.resource_tier ?? "",
  });
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleChange(next: PersonalizationValues) {
    setValues(next);
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
            updateProfile(values.location, values.learningPreferences, values.careerStage, values.accommodation, values.resourceTier);
          });
          setSaved(true);
        }}
        style={{ display: "flex", flexDirection: "column", gap: 20 }}
      >
        <PersonalizationFields value={values} onChange={handleChange} />

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
