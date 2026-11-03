"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { startMyRoleAssessment } from "@/lib/assessment/actions";

export default function StartRoleAssessmentButton() {
  const t = useTranslations("roleAssessment");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div style={{ marginTop: 14 }}>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await startMyRoleAssessment();
            if ("error" in r && r.error) {
              setError(r.error);
              return;
            }
            if ("assessmentId" in r) router.push(`/dashboard/role-assessment/${r.assessmentId}`);
          })
        }
        style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: pending ? 0.6 : 1 }}
      >
        {pending ? t("selfStarting") : t("startSelf")}
      </button>
      {error && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>{error}</p>}
    </div>
  );
}
