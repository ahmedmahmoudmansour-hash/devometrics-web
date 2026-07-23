"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { verifyInviteCode } from "@/lib/auth/inviteGate";

// Supabase's AuthError.message is usually a clean string, but errors
// surfaced from the auth server's own side effects (e.g. its SMTP relay
// rejecting a confirmation email) don't always arrive in that shape —
// falling back here means a user never sees a raw `{}` instead of words.
function readableAuthError(error: { message?: unknown }): string {
  return typeof error.message === "string" && error.message.trim()
    ? error.message
    : "Something went wrong — please try again in a moment.";
}

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
  transition: "border-color 0.15s ease",
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

export default function AuthForm({ mode }: { mode: "signup" | "login" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [accountType, setAccountType] = useState<"individual" | "company">("individual");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(readableAuthError(error));
      return;
    }
    setResetSent(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === "signup") {
      const inviteResult = await verifyInviteCode(inviteCode);
      if (!inviteResult.ok) {
        setLoading(false);
        setError(inviteResult.error ?? "Invalid invite code");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, account_type: accountType },
          // Without this, the confirmation link falls back to the
          // project's Supabase "Site URL" setting — which drifts from
          // whatever's actually deployed (e.g. still pointing at
          // localhost from local dev) unless someone remembers to keep
          // it in sync. Passing it explicitly, the same way
          // resetPasswordForEmail already does below, makes the link
          // always point at wherever this page is actually running.
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });
      setLoading(false);
      if (error) {
        setError(readableAuthError(error));
        return;
      }
      // If email confirmation isn't required (or already satisfied), signUp
      // returns an active session immediately — showing "check your inbox"
      // in that case would be actively misleading since the account is
      // already usable. Company accounts still need to create/join a
      // workspace before the rest of the dashboard makes sense for them.
      if (data.session) {
        router.push(accountType === "company" ? "/dashboard/company/setup" : "/dashboard");
        router.refresh();
        return;
      }
      setCheckEmail(true);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(readableAuthError(error));
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  if (checkEmail) {
    return (
      <div
        style={{
          background: "rgba(0,201,167,0.1)",
          border: "1px solid rgba(0,201,167,0.3)",
          borderRadius: 12,
          padding: "28px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            background: "rgba(0,201,167,0.15)",
            color: "var(--teal)",
            fontSize: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 14px",
          }}
        >
          ✉️
        </div>
        <p style={{ color: "var(--teal)", fontWeight: 700, fontSize: 16 }}>
          Almost there — check your inbox
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
          We sent a confirmation link to <strong style={{ color: "var(--text)" }}>{email}</strong>.
          Click it to finish creating your account — you&apos;ll land right back here, ready to go.
          Don&apos;t see it? Check your spam or junk folder.
        </p>
      </div>
    );
  }

  if (forgotPassword) {
    if (resetSent) {
      return (
        <div
          style={{
            background: "rgba(0,201,167,0.1)",
            border: "1px solid rgba(0,201,167,0.3)",
            borderRadius: 12,
            padding: "28px",
            textAlign: "center",
          }}
        >
          <p style={{ color: "var(--teal)", fontWeight: 700, fontSize: 16 }}>Check your inbox</p>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
            If an account exists for <strong style={{ color: "var(--text)" }}>{email}</strong>, we sent a
            password reset link. It expires after a while, so use it soon.
            Don&apos;t see it? Check your spam or junk folder.
          </p>
          <button
            type="button"
            onClick={() => {
              setForgotPassword(false);
              setResetSent(false);
            }}
            style={{ marginTop: 16, background: "none", border: "none", color: "var(--teal)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            ← Back to log in
          </button>
        </div>
      );
    }
    return (
      <form onSubmit={handleResetRequest} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
          Enter the email on your account and we&apos;ll send you a link to set a new password.
        </p>
        <div>
          <label style={labelStyle} htmlFor="reset-email">Email address</label>
          <input
            id="reset-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={inputStyle}
          />
        </div>
        {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ ...buttonStyle, opacity: loading ? 0.6 : 1 }}>
          {loading ? "Sending…" : "Send reset link"}
        </button>
        <button
          type="button"
          onClick={() => setForgotPassword(false)}
          style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}
        >
          ← Back to log in
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {mode === "signup" && (
        <div>
          <label style={labelStyle} htmlFor="auth-invite-code">Invite code</label>
          <input
            id="auth-invite-code"
            type="text"
            required
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Ask whoever invited you"
            style={inputStyle}
          />
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
            Devometrics is invite-only during testing — you&apos;ll need a code from us to create an
            account.
          </p>
        </div>
      )}
      {mode === "signup" && (
        <div>
          <label style={labelStyle}>Account type</label>
          <div style={{ display: "flex", gap: 8 }}>
            {(["individual", "company"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setAccountType(type)}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: accountType === type ? "1px solid rgba(0,201,167,0.4)" : "1px solid rgba(255,255,255,0.1)",
                  background: accountType === type ? "rgba(0,201,167,0.12)" : "rgba(255,255,255,0.05)",
                  color: accountType === type ? "var(--teal)" : "var(--text-muted)",
                }}
              >
                {type === "individual" ? "Individual" : "Company / Enterprise"}
              </button>
            ))}
          </div>
          {accountType === "company" && (
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
              You&apos;ll set up your company workspace (create a new one or join with an invite code)
              right after this step.
            </p>
          )}
        </div>
      )}
      {mode === "signup" && (
        <div>
          <label style={labelStyle} htmlFor="auth-full-name">Full name</label>
          <input
            id="auth-full-name"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Doe"
            style={inputStyle}
          />
        </div>
      )}
      <div>
        <label style={labelStyle} htmlFor="auth-email">Email address</label>
        <input
          id="auth-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={inputStyle}
        />
      </div>
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <label style={{ ...labelStyle, marginBottom: 6 }} htmlFor="auth-password">Password</label>
          {mode === "login" && (
            <button
              type="button"
              onClick={() => setForgotPassword(true)}
              style={{ background: "none", border: "none", color: "var(--teal)", fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 6 }}
            >
              Forgot password?
            </button>
          )}
        </div>
        <input
          id="auth-password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === "signup" ? "At least 6 characters" : "Password"}
          style={inputStyle}
        />
      </div>
      {error && (
        <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>
      )}
      <button type="submit" disabled={loading} style={{ ...buttonStyle, opacity: loading ? 0.6 : 1 }}>
        {loading ? "Please wait…" : mode === "signup" ? "Create my account" : "Log in"}
      </button>
      <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>
        {mode === "signup" ? (
          <>Already have an account? <Link href="/login" style={{ color: "var(--teal)", fontWeight: 600 }}>Log in</Link></>
        ) : (
          <>Don&apos;t have an account? <Link href="/signup" style={{ color: "var(--teal)", fontWeight: 600 }}>Sign up free</Link></>
        )}
      </p>
    </form>
  );
}
