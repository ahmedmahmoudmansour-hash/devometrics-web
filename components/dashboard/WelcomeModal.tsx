"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";

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
function buildSteps(
  name: string | null,
  role: "admin" | "member" | null,
  t: (key: string, values?: Record<string, string | number>) => string
): Step[] {
  const steps: Step[] = [
    {
      title: name ? t("welcomeTitleNamed", { name }) : t("welcomeTitle"),
      body: (
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
          {role === "admin"
            ? t("welcomeBodyAdmin")
            : role === "member"
              ? t("welcomeBodyMember")
              : t("welcomeBodyIndividual")}{" "}
          {t("welcomeBodySuffix")}
        </p>
      ),
    },
    {
      title: t("threeWaysTitle"),
      body: (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <p style={groupLabelStyle}>{t("understandLabel")}</p>
            <p style={groupTextStyle}>{t("understandBody")}</p>
          </div>
          <div>
            <p style={groupLabelStyle}>{t("growLabel")}</p>
            <p style={groupTextStyle}>{t("growBody")}</p>
          </div>
          <div>
            <p style={groupLabelStyle}>{t("organizeLabel")}</p>
            <p style={groupTextStyle}>{t("organizeBody")}</p>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            {t("tipPrefix")}{" "}
            <kbd style={{ border: "1px solid var(--border)", borderRadius: 4, padding: "1px 5px", fontSize: 11 }}>{t("tipKey")}</kbd>{" "}
            {t("tipSuffix")}
          </p>
        </div>
      ),
    },
  ];

  if (role === "admin") {
    steps.push({
      title: t("runOrgTitle"),
      body: (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.7 }}>
            {t("runOrgIntroPrefix")} <strong style={{ color: "var(--text)" }}>{t("runOrgIntroStrong")}</strong> {t("runOrgIntroSuffix")}
          </p>
          <ul style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.9, paddingInlineStart: 20 }}>
            <li><strong>{t("adminBullet1Strong")}</strong> {t("adminBullet1Rest")}</li>
            <li><strong>{t("adminBullet2Strong")}</strong> {t("adminBullet2Rest")}</li>
            <li><strong>{t("adminBullet3Strong")}</strong> {t("adminBullet3Rest")}</li>
            <li><strong>{t("adminBullet4Strong")}</strong> {t("adminBullet4Rest")}</li>
            <li><strong>{t("adminBullet5Strong")}</strong> {t("adminBullet5Rest")}</li>
            <li><strong>{t("adminBullet6Strong")}</strong> {t("adminBullet6Rest")}</li>
          </ul>
        </div>
      ),
    });
  }

  if (role === "member") {
    steps.push({
      title: t("memberTitle"),
      body: (
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
          {t("memberBodyPrefix")} <strong style={{ color: "var(--text)" }}>{t("memberBodyTasks")}</strong>
          {t("memberBodyMiddle1")}{" "}
          <strong style={{ color: "var(--text)" }}>{t("memberBodyWorkspace")}</strong>
          {t("memberBodyMiddle2")}{" "}
          <strong style={{ color: "var(--text)" }}>{t("memberBodyCoach")}</strong>{" "}
          {t("memberBodySuffix")}
        </p>
      ),
    });
  }

  steps.push({
    title: t("readyTitle"),
    body: (
      <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
        {t("readyBody")}
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
  const t = useTranslations("welcomeModal");
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

  const steps = buildSteps(name, role, t);
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
          border: "1px solid rgba(var(--teal-rgb),0.3)",
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
            {t("skip")}
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
            {isLastStep ? t("startGrowth") : t("next")}
          </button>
        </div>
      </div>
    </div>
  );
}
