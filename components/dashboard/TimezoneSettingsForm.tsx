"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { COMMON_TIMEZONES } from "@/lib/organizations/timezones";
import { setOrganizationTimezone } from "@/lib/organizations/timezone";

// The clock attendance runs on (0192). Each company sets its own; clock-in
// and clock-out are stamped with this timezone by the server, not by the
// employee's device.
export default function TimezoneSettingsForm({ organizationId, initialTimezone }: { organizationId: string; initialTimezone: string }) {
  const t = useTranslations("timezoneSettings");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [timezone, setTimezone] = useState(initialTimezone);
  const [error, setError] = useState<string | null>(null);
  // A zone the company already has that isn't in the short list still shows.
  const options = (COMMON_TIMEZONES as readonly string[]).includes(initialTimezone) ? [...COMMON_TIMEZONES] : [initialTimezone, ...COMMON_TIMEZONES];

  function handleChange(next: string) {
    const previous = timezone;
    setTimezone(next);
    setError(null);
    startTransition(async () => {
      const result = await setOrganizationTimezone(organizationId, next);
      if ("error" in result) {
        setTimezone(previous);
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{t("title")}</h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6, maxWidth: 560 }}>{t("description")}</p>
      <select
        value={timezone}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending}
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 14px", fontSize: 14, color: "var(--text)", outline: "none", maxWidth: 360 }}
      >
        {options.map((z) => (
          <option key={z} value={z}>
            {z.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      {error && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{error}</p>}
    </div>
  );
}
