"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCustomScenario } from "@/app/dashboard/roleplay/customActions";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 14,
  color: "var(--text)",
  outline: "none",
  fontFamily: "inherit",
  resize: "vertical" as const,
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--text-muted)",
  display: "block",
  marginBottom: 6,
};

export default function CreateScenarioForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [setup, setSetup] = useState("");
  const [yourRole, setYourRole] = useState("");
  const [openingMessage, setOpeningMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createCustomScenario({ title, setup, yourRole, openingMessage });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(`/dashboard/roleplay/custom/${result.scenarioId}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <label htmlFor="scenario-title" style={labelStyle}>
          Scenario name
        </label>
        <input
          id="scenario-title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Negotiating scope with a client who keeps adding requests"
          style={inputStyle}
        />
      </div>
      <div>
        <label htmlFor="scenario-setup" style={labelStyle}>
          The situation
        </label>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: -4, marginBottom: 8, lineHeight: 1.5 }}>
          Describe what&apos;s going on and who the other person is — this is what the AI reads to play them realistically.
        </p>
        <textarea
          id="scenario-setup"
          required
          rows={4}
          value={setup}
          onChange={(e) => setSetup(e.target.value)}
          placeholder="e.g. A long-time client keeps adding 'small' requests outside the agreed scope. You've absorbed a few already, but it's eating your margin and the team's time."
          style={inputStyle}
        />
      </div>
      <div>
        <label htmlFor="scenario-role" style={labelStyle}>
          Your role in this conversation
        </label>
        <textarea
          id="scenario-role"
          required
          rows={2}
          value={yourRole}
          onChange={(e) => setYourRole(e.target.value)}
          placeholder="e.g. You're the account lead, about to raise the scope-creep issue directly with the client."
          style={inputStyle}
        />
      </div>
      <div>
        <label htmlFor="scenario-opening" style={labelStyle}>
          How the other person opens the conversation
        </label>
        <textarea
          id="scenario-opening"
          required
          rows={2}
          value={openingMessage}
          onChange={(e) => setOpeningMessage(e.target.value)}
          placeholder={'e.g. "Hey, thanks for hopping on — I actually had one more small thing to add to the list, is that alright?"'}
          style={inputStyle}
        />
      </div>

      {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        style={{
          alignSelf: "flex-start",
          background: "var(--teal)",
          color: "#0A0F1E",
          border: "none",
          borderRadius: 8,
          padding: "12px 24px",
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          opacity: isPending ? 0.6 : 1,
        }}
      >
        {isPending ? "Creating…" : "Start this scenario"}
      </button>
    </form>
  );
}
