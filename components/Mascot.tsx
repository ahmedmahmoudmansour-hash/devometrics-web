"use client";

import { useId } from "react";

// The one custom illustrated character for the brand — deliberately built
// from the same "ascending gap bars" motif as Logo.tsx (a figure climbing
// its own growth bars, flag raised at the top) rather than an unrelated
// illustration style or a generic AI-trope mascot (no robot, no brain/circuit
// imagery). useId() keeps gradient ids collision-free when this renders more
// than once on the same page (e.g. several empty states at once).
export default function Mascot({ size = 96, className = "" }: { size?: number; className?: string }) {
  const uid = useId().replace(/:/g, "");

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Devometrics mascot climbing its growth bars"
      className={className}
    >
      <defs>
        <linearGradient id={`mascot-bar-${uid}`} x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00C9A7" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
        <linearGradient id={`mascot-body-${uid}`} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00C9A7" />
          <stop offset="100%" stopColor="#7dd3fc" />
        </linearGradient>
      </defs>

      {/* Ascending gap bars, same motif as the wordmark logo */}
      <rect x="6" y="46" width="8" height="12" rx="2" fill={`url(#mascot-bar-${uid})`} opacity="0.45" />
      <rect x="17" y="38" width="8" height="20" rx="2" fill={`url(#mascot-bar-${uid})`} opacity="0.65" />
      <rect x="28" y="28" width="8" height="30" rx="2" fill={`url(#mascot-bar-${uid})`} opacity="0.85" />

      {/* The character, standing atop the tallest bar */}
      <g transform="translate(38, 6)">
        {/* Flag */}
        <line x1="14" y1="0" x2="14" y2="10" stroke="#00C9A7" strokeWidth="2" strokeLinecap="round" />
        <path d="M14 0 L22 3 L14 6 Z" fill="#fbbf24" />
        {/* Body */}
        <circle cx="7" cy="16" r="10" fill={`url(#mascot-body-${uid})`} />
        {/* Face */}
        <circle cx="4" cy="15" r="1.4" fill="#0A0F1E" />
        <circle cx="10" cy="15" r="1.4" fill="#0A0F1E" />
        <path d="M3.5 19 Q7 21.5 10.5 19" stroke="#0A0F1E" strokeWidth="1.4" strokeLinecap="round" fill="none" />
        {/* Arms */}
        <path d="M-1 13 Q-5 10 -6 4" stroke={`url(#mascot-body-${uid})`} strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M15 13 Q17 16 15 22" stroke={`url(#mascot-body-${uid})`} strokeWidth="3" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}
