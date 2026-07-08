"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Mascot from "./Mascot";

export default function Hero() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    router.push(`/signup?email=${encodeURIComponent(email)}`);
  };

  return (
    <section
      id="hero"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "120px 24px 80px",
        position: "relative",
        overflow: "hidden",
        textAlign: "center",
      }}
    >
      {/* Background glow orbs */}
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,201,167,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "40%",
          left: "20%",
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(125,211,252,0.04) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "30%",
          right: "15%",
          width: 250,
          height: 250,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,201,167,0.04) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Grid lines background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          pointerEvents: "none",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 50%, black 0%, transparent 100%)",
        }}
      />

      <div style={{ position: "relative", maxWidth: 800, margin: "0 auto" }}>
        {/* Mascot */}
        <div className="fade-up fade-up-1" style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
          <Mascot size={100} className="float" />
        </div>

        {/* Badge */}
        <div
          className="fade-up fade-up-1"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(0,201,167,0.08)",
            border: "1px solid rgba(0,201,167,0.2)",
            borderRadius: 100,
            padding: "6px 16px",
            marginBottom: 32,
          }}
        >
          <span className="teal-dot" style={{ width: 6, height: 6, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "var(--teal)", fontWeight: 600, letterSpacing: "0.04em" }}>
            Now in early access — create your account free
          </span>
        </div>

        {/* Headline */}
        <h1
          className="fade-up fade-up-2"
          style={{
            fontSize: "clamp(2.4rem, 6vw, 4.5rem)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            marginBottom: 24,
            color: "var(--text)",
          }}
        >
          The science of{" "}
          <span className="gradient-text">career growth</span>
        </h1>

        {/* Subheadline */}
        <p
          className="fade-up fade-up-3"
          style={{
            fontSize: "clamp(1rem, 2.5vw, 1.25rem)",
            color: "var(--text-muted)",
            lineHeight: 1.7,
            maxWidth: 620,
            margin: "0 auto 48px",
            fontWeight: 400,
          }}
        >
          Upload your CV, a job description, and your ambitions. Devometrics builds
          a precise competency gap map and a prioritized, time-bound plan to close it —
          not course recommendations. A real career advisor, powered by AI.
        </p>

        {/* Email capture */}
        <div className="fade-up fade-up-4" id="waitlist">
          <form onSubmit={handleSubmit} style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <input
              type="email"
              required
              aria-label="Email address for early access"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10,
                padding: "14px 20px",
                fontSize: 15,
                color: "var(--text)",
                outline: "none",
                width: 280,
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(0,201,167,0.4)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            />
            <button
              type="submit"
              style={{
                background: "var(--teal)",
                color: "#0A0F1E",
                border: "none",
                borderRadius: 10,
                padding: "14px 28px",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: "0.01em",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "var(--teal-dim)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 24px rgba(0,201,167,0.35)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "var(--teal)";
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            >
              Get early access →
            </button>
          </form>
          <p style={{ marginTop: 14, fontSize: 13, color: "var(--text-muted)" }}>
            Takes 30 seconds — no credit card required.
          </p>
        </div>

        {/* Social proof numbers */}
        <div
          className="fade-up fade-up-4"
          style={{
            display: "flex",
            gap: 40,
            justifyContent: "center",
            marginTop: 64,
            flexWrap: "wrap",
          }}
        >
          {[
            { value: "8", label: "Competency dimensions" },
            { value: "4", label: "Plan horizons" },
            { value: "AI-first", label: "Gap analysis engine" },
          ].map((stat) => (
            <div key={stat.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "var(--teal)", letterSpacing: "-0.02em" }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        style={{
          position: "absolute",
          bottom: 32,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          opacity: 0.4,
        }}
      >
        <span style={{ fontSize: 12, letterSpacing: "0.1em", color: "var(--text-muted)" }}>SCROLL</span>
        <svg width="16" height="24" viewBox="0 0 16 24" fill="none">
          <rect x="0.75" y="0.75" width="14.5" height="22.5" rx="7.25" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8" cy="8" r="2" fill="var(--teal)">
            <animate attributeName="cy" from="6" to="14" dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="1" to="0" dur="1.5s" repeatCount="indefinite" />
          </circle>
        </svg>
      </div>
    </section>
  );
}
