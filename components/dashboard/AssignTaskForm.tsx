"use client";

import { useState, useTransition } from "react";
import { assignTaskToEmployee } from "@/lib/organizations/actions";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 14,
  color: "var(--text)",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--text-muted)",
  display: "block",
  marginBottom: 6,
};

export default function AssignTaskForm({
  employeeUserId,
  plans,
}: {
  employeeUserId: string;
  plans: { id: string; title: string }[];
}) {
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await assignTaskToEmployee(employeeUserId, planId || null, {
        title,
        description: description || undefined,
        targetDate: targetDate || undefined,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setTitle("");
      setDescription("");
      setTargetDate("");
      setSaved(true);
    });
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
        Assign a task
      </h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
        {plans.length > 0
          ? "Adds a milestone to one of their existing plans, flagged as assigned by you."
          : "This employee has no development plan yet — assigning a task creates one for them."}
      </p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {plans.length > 0 && (
          <div>
            <label style={labelStyle}>Plan</label>
            <select value={planId} onChange={(e) => setPlanId(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label style={labelStyle}>Task title</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Complete the Strategic Thinking assessment"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>
        <div>
          <label style={labelStyle}>Target date (optional)</label>
          <input
            type="date"
            lang="en-US"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            style={{ ...inputStyle, colorScheme: "dark" }}
          />
        </div>

        {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}

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
          {isPending ? "Assigning…" : saved ? "Assigned" : "Assign task"}
        </button>
      </form>
    </div>
  );
}
