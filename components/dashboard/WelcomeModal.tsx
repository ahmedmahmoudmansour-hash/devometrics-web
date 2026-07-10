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

const groupLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color: "var(--teal)",
  marginBottom: 2,
};
const groupTextStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--text)",
  lineHeight: 1.65,
};

// Mirrors the sidebar's Understand / Grow / Organize sections on purpose —
// the first thing a new user learns is the same mental model they'll
// navigate by, instead of a feature list organized differently from the
// product itself.
function buildSteps(name: string | null, role: "admin" | "member" | null): Step[] {
  const steps: Step[] = [
    {
      title: `Welcome${name ? `, ${name}` : ""} 👋`,
      body: (
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
          {role === "admin"
            ? "This is your organization's talent intelligence workspace — and your own career home too."
            : role === "member"
              ? "Your organization has set you up on Devometrics to support your career growth."
              : "You're all set up on Devometrics."}{" "}
          Here&apos;s the lay of the land — it takes 30 seconds, then we&apos;ll get out of your way.
        </p>
      ),
    },
    {
      title: "Three ways in",
      body: (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <p style={groupLabelStyle}>Understand</p>
            <p style={groupTextStyle}>
              Where do you actually stand? The Discovery interview, Gap Analysis, and Assessments
              measure your competencies against the role you want — no guesswork.
            </p>
          </div>
          <div>
            <p style={groupLabelStyle}>Grow</p>
            <p style={groupTextStyle}>
              Close the gap: your AI Coach (voice or text), Practice Scenarios for interviews and
              hard conversations, and a Career Paths map of where you can realistically go next.
            </p>
          </div>
          <div>
            <p style={groupLabelStyle}>Organize</p>
            <p style={groupTextStyle}>
              Make it a routine: Tasks &amp; Calendar (sync to Outlook or Google), and a private
              Workspace where AI turns your notes into action items.
            </p>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            Tip: press <kbd style={{ border: "1px solid var(--border)", borderRadius: 4, padding: "1px 5px", fontSize: 11 }}>Ctrl K</kbd>{" "}
            anywhere to jump straight to any of it.
          </p>
        </div>
      ),
    },
  ];

  if (role === "admin") {
    steps.push({
      title: "Run your organization",
      body: (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.7 }}>
            The <strong style={{ color: "var(--text)" }}>Company</strong> section is yours alone as
            an admin:
          </p>
          <ul style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.9, paddingLeft: 20 }}>
            <li><strong>Employees</strong> — workforce skill inventory, talent heatmap, capability pyramid, Excel export</li>
            <li><strong>Invite &amp; manage</strong> — add people by email, edit titles/departments, archive leavers</li>
            <li><strong>Surveys</strong> — AI-generated culture and pulse surveys with anonymized results</li>
            <li><strong>Competency framework</strong> — define what great looks like for your organization</li>
            <li><strong>Assign development plans</strong> — set milestones for any employee</li>
          </ul>
        </div>
      ),
    });
  }

  if (role === "member") {
    steps.push({
      title: "What's yours stays yours",
      body: (
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
          Your organization sees your competency profile and development progress — that&apos;s how
          they support your growth. But your <strong style={{ color: "var(--text)" }}>Tasks</strong>,{" "}
          <strong style={{ color: "var(--text)" }}>Workspace notes</strong>, and{" "}
          <strong style={{ color: "var(--text)" }}>Coach conversations</strong> are private to you —
          never visible to your manager or employer, by design.
        </p>
      ),
    });
  }

  steps.push({
    title: "Ready to start?",
    body: (
      <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
        Everything here is built around one goal: closing the specific gap between where you are
        and where you want to be. Let&apos;s embark on your career development journey.
      </p>
    ),
  });

  return steps;
}

export default function WelcomeModal({
  name,
  role,
}: {
  name: string | null;
  // Org role, not account type: an org ADMIN gets the enterprise tour, an
  // org MEMBER gets the privacy-boundary step, and null (individual, or a
  // company account still mid-setup) gets the personal tour only.
  role: "admin" | "member" | null;
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

  const steps = buildSteps(name, role);
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
