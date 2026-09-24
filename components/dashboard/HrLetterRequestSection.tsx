"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { requestHrLetter, type HrLetterRequest } from "@/lib/hrLetters/actions";

const fieldStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 14,
  color: "var(--text)",
  outline: "none",
  width: "100%",
};
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, display: "block" };
const btnPrimary: React.CSSProperties = {
  background: "var(--teal)",
  color: "#0A0F1E",
  border: "none",
  borderRadius: 8,
  padding: "10px 20px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

// A separate small self-contained feature, not folded into MyLeaveManager —
// an HR letter request isn't leave/vacation data, it just lives on the same
// page for convenience (see 0169's header for the full reasoning).
export default function HrLetterRequestSection({
  organizationId,
  initialRequests,
}: {
  organizationId: string;
  initialRequests: HrLetterRequest[];
}) {
  const t = useTranslations("hrLetterSection");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [requests, setRequests] = useState(initialRequests);
  const [showForm, setShowForm] = useState(false);
  const [includeSalary, setIncludeSalary] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await requestHrLetter({ organizationId, includeSalary, purpose: purpose.trim() || null });
      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccess(t("requestSubmitted"));
        setRequests((prev) => [
          {
            id: result.id,
            employeeUserId: "",
            requestedBy: "",
            includeSalary,
            purpose: purpose.trim() || null,
            status: "pending",
            requestedAt: new Date().toISOString(),
            decidedAt: null,
            decidedBy: null,
            decisionNote: null,
          },
          ...prev,
        ]);
        setPurpose("");
        setIncludeSalary(false);
        setShowForm(false);
        router.refresh();
      }
    });
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 0 }}>{t("title")}</h2>
        {!showForm && (
          <button type="button" onClick={() => setShowForm(true)} style={{ ...btnPrimary, padding: "8px 16px", fontSize: 13 }}>
            + {t("newRequestButton")}
          </button>
        )}
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: showForm ? 16 : 6, lineHeight: 1.6 }}>{t("description")}</p>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ marginBottom: 18, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>{t("includeSalaryLabel")}</label>
            <select value={includeSalary ? "yes" : "no"} onChange={(e) => setIncludeSalary(e.target.value === "yes")} style={fieldStyle}>
              <option value="no">{t("withoutSalary")}</option>
              <option value="yes">{t("withSalary")}</option>
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>{t("purposeLabel")}</label>
            <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder={t("purposePlaceholder")} style={fieldStyle} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" disabled={isPending} style={{ ...btnPrimary, opacity: isPending ? 0.6 : 1 }}>
              {isPending ? t("submitting") : t("submitButton")}
            </button>
            <button type="button" onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>
              {t("cancelButton")}
            </button>
          </div>
          {error && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{error}</p>}
        </form>
      )}
      {success && <p style={{ color: "var(--teal)", fontSize: 13, marginBottom: 12 }}>{success}</p>}

      {requests.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("noRequestsYet")}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          {requests.map((r) => (
            <div key={r.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, fontSize: 13 }}>
                <span style={{ color: "var(--text)" }}>
                  {new Date(r.requestedAt).toLocaleDateString()} — {r.includeSalary ? t("withSalary") : t("withoutSalary")}
                  {r.purpose && <span style={{ color: "var(--text-muted)" }}> · {r.purpose}</span>}
                </span>
                <span
                  style={{
                    color: r.status === "issued" ? "var(--teal)" : r.status === "rejected" ? "var(--danger)" : "var(--text-muted)",
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  {t(`status_${r.status}`)}
                </span>
              </div>
              {r.decisionNote && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>{t("decisionNoteLabel")}: {r.decisionNote}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
