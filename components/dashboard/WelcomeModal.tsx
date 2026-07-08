"use client";

import { useState, useSyncExternalStore } from "react";

const STORAGE_KEY = "devometrics-welcome-seen";

function noopSubscribe() {
  return () => {};
}
function hasNotSeenWelcome(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === null;
  } catch {
    return false;
  }
}
function getServerSnapshot() {
  return false; // never render this during SSR — only decide once mounted client-side
}

type Step = {
  title: string;
  body: React.ReactNode;
};

function buildSteps(name: string | null, isEnterprise: boolean): Step[] {
  return [
    {
      title: `Welcome${name ? `, ${name}` : ""} 👋`,
      body: (
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
          {isEnterprise
            ? "Your organization has set you up on Devometrics to support your career growth."
            : "You're all set up on Devometrics."}{" "}
          Here&apos;s a quick look at what you can do, then we&apos;ll get out of your way.
        </p>
      ),
    },
    {
      title: "Everything at a glance",
      body: (
        <ul style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.9, paddingLeft: 20 }}>
          <li><strong>Gap Analysis</strong> — see exactly which skills stand between you and your target role</li>
          <li><strong>Development Plan</strong> — a prioritized, time-bound plan to close those gaps</li>
          <li><strong>AI Coach</strong> — ongoing coaching, voice or text, that knows your plan and progress</li>
          <li><strong>Assessments &amp; Interview Simulator</strong> — practice and prove your skills</li>
          <li><strong>Tasks &amp; Calendar</strong> — turn the plan into a real weekly routine</li>
        </ul>
      ),
    },
    {
      title: "Ready to start?",
      body: (
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
          Everything here is built around one goal: closing the specific gap between where you are
          and where you want to be. Let&apos;s embark on your career development journey.
        </p>
      ),
    },
  ];
}

export default function WelcomeModal({
  name,
  accountType,
}: {
  name: string | null;
  accountType: "individual" | "company";
}) {
  const notSeenBefore = useSyncExternalStore(noopSubscribe, hasNotSeenWelcome, getServerSnapshot);
  const [dismissedThisSession, setDismissedThisSession] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const visible = notSeenBefore && !dismissedThisSession;

  function dismiss() {
    setDismissedThisSession(true);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore — worst case it shows again next visit, not a big deal
    }
  }

  if (!visible) return null;

  const steps = buildSteps(name, accountType === "company");
  const isLastStep = stepIndex === steps.length - 1;
  const step = steps[stepIndex];

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(3,8,16,0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 24,
      }}
    >
      <div
        style={{
          background: "var(--navy-mid)",
          border: "1px solid rgba(0,201,167,0.3)",
          borderRadius: 20,
          padding: 36,
          maxWidth: 480,
          width: "100%",
          boxShadow: "0 20px 80px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {steps.map((_, i) => (
            <div
              key={i}
              style={{
                height: 4,
                flex: 1,
                borderRadius: 2,
                background: i <= stepIndex ? "var(--teal)" : "rgba(255,255,255,0.1)",
              }}
            />
          ))}
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", marginBottom: 12 }}>
          {step.title}
        </h1>
        <div style={{ marginBottom: 28 }}>{step.body}</div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            type="button"
            onClick={dismiss}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              fontSize: 13,
              cursor: "pointer",
              padding: 0,
            }}
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => (isLastStep ? dismiss() : setStepIndex((i) => i + 1))}
            style={{
              background: "var(--teal)",
              color: "#0A0F1E",
              border: "none",
              borderRadius: 8,
              padding: "10px 22px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {isLastStep ? "Start my career growth →" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
