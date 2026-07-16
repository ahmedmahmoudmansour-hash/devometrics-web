"use client";

import { useEffect, useRef, useState } from "react";

// Scroll-triggered entrance — the one signature every top-tier marketing
// site (Stripe, Linear, Vercel) shares that this one didn't have: content
// below the fold used to just be present on load, with no choreography.
// IntersectionObserver rather than a scroll listener (cheaper, no manual
// throttling), and it disconnects itself after first reveal — this is a
// one-time entrance, not a repeating scroll gimmick.
//
// prefers-reduced-motion is handled for free: globals.css already forces
// animation-duration to ~0 app-wide under that media query, and the
// fallback opacity here is 1 (not 0) whenever JS hasn't run yet or the
// observer hasn't fired, so nothing ever gets stuck invisible.
export default function Reveal({
  children,
  delayMs = 0,
  className,
}: {
  children: React.ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -80px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.7s ease ${delayMs}ms, transform 0.7s ease ${delayMs}ms`,
      }}
    >
      {children}
    </div>
  );
}
