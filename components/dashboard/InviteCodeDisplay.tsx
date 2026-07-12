"use client";

import { useState } from "react";

// Small teams often prefer sharing one code over an admin entering every
// email individually — but a plain, un-copyable string meant re-typing it
// by hand into Slack/WhatsApp, real friction for exactly that use case.
export default function InviteCodeDisplay({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(slug);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the code is still visible and selectable.
    }
  }

  return (
    <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span>
        Invite code:{" "}
        <code style={{ color: "var(--teal)", background: "rgba(0,201,167,0.08)", padding: "2px 6px", borderRadius: 4 }}>
          {slug}
        </code>
      </span>
      <button
        type="button"
        onClick={copy}
        style={{
          background: "none",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "2px 10px",
          fontSize: 11,
          fontWeight: 700,
          color: copied ? "var(--teal)" : "var(--text-muted)",
          cursor: "pointer",
        }}
      >
        {copied ? "✓ Copied" : "Copy"}
      </button>
      <span style={{ fontSize: 11 }}>— anyone with this code can join your workspace as a member</span>
    </p>
  );
}
