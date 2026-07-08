"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text-muted)",
  marginBottom: 6,
  display: "block",
};

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  padding: "13px 16px",
  fontSize: 15,
  color: "var(--text)",
  outline: "none",
  width: "100%",
};

const buttonStyle: React.CSSProperties = {
  background: "var(--teal)",
  color: "#0A0F1E",
  border: "none",
  borderRadius: 10,
  padding: "14px 20px",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
  width: "100%",
};

export default function ResetPasswordForm() {
  const router = useRouter();
  const supabase = createClient();

  const [ready, setReady] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // The recovery link establishes a temporary session client-side once
    // Supabase processes the URL — check for it rather than assume it's
    // there immediately on mount.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setValidSession(true);
      }
      setReady(true);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setValidSession(true);
      setReady(true);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div style={{ background: "rgba(0,201,167,0.1)", border: "1px solid rgba(0,201,167,0.3)", borderRadius: 12, padding: 28, textAlign: "center" }}>
        <p style={{ color: "var(--teal)", fontWeight: 700, fontSize: 16 }}>Password updated</p>
        <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
          You&apos;re all set — head back to your dashboard.
        </p>
        <button
          type="button"
          onClick={() => {
            router.push("/dashboard");
            router.refresh();
          }}
          style={{ ...buttonStyle, marginTop: 16 }}
        >
          Go to dashboard
        </button>
      </div>
    );
  }

  if (!ready) {
    return <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Verifying your reset link…</p>;
  }

  if (!validSession) {
    return (
      <div>
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
          This reset link is invalid or has expired. Request a new one from the login page.
        </p>
        <Link href="/login" style={{ display: "inline-block", marginTop: 16, color: "var(--teal)", fontSize: 14, fontWeight: 600 }}>
          ← Back to log in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <label style={labelStyle} htmlFor="new-password">New password</label>
        <input
          id="new-password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle} htmlFor="confirm-password">Confirm new password</label>
        <input
          id="confirm-password"
          type="password"
          required
          minLength={6}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter your new password"
          style={inputStyle}
        />
      </div>
      {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}
      <button type="submit" disabled={loading} style={{ ...buttonStyle, opacity: loading ? 0.6 : 1 }}>
        {loading ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
