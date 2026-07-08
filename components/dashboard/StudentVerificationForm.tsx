"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestStudentVerification, confirmStudentVerification } from "@/lib/billing/studentVerification";

export default function StudentVerificationForm() {
  const [step, setStep] = useState<"email" | "code" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await requestStudentVerification(email);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setStep("code");
    });
  }

  function handleConfirmCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await confirmStudentVerification(code);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setStep("done");
      router.refresh();
    });
  }

  if (step === "done") {
    return (
      <div
        style={{
          background: "rgba(0,201,167,0.06)",
          border: "1px solid rgba(0,201,167,0.25)",
          borderRadius: 16,
          padding: 20,
          fontSize: 13,
          color: "var(--teal)",
        }}
      >
        Student status verified — the student discount will apply at checkout.
      </div>
    );
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
        Get the student discount
      </p>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
        Verify with your school or university email to unlock 60% off Premium.
      </p>
      {step === "email" ? (
        <form onSubmit={handleRequestCode} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="School email address"
            placeholder="you@university.edu"
            style={{
              flex: "1 1 200px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 13,
              color: "var(--text)",
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={isPending}
            style={{
              background: "var(--teal)",
              color: "#0A0F1E",
              border: "none",
              borderRadius: 8,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {isPending ? "Sending…" : "Send code"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleConfirmCode} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="text"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-label="Verification code"
            placeholder="6-digit code"
            style={{
              flex: "1 1 160px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 13,
              color: "var(--text)",
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={isPending}
            style={{
              background: "var(--teal)",
              color: "#0A0F1E",
              border: "none",
              borderRadius: 8,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {isPending ? "Verifying…" : "Verify"}
          </button>
        </form>
      )}
      {error && <p style={{ color: "#f87171", fontSize: 12, marginTop: 8 }}>{error}</p>}
    </div>
  );
}
