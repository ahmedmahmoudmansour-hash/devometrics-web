"use client";

interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}

export default function Logo({ size = 36, showWordmark = true, className = "" }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Icon mark */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Outer ring */}
        <circle cx="20" cy="20" r="19" stroke="url(#ring-grad)" strokeWidth="1.5" />
        {/* Gap bars — the core brand motif */}
        <rect x="8" y="26" width="5" height="8" rx="1.5" fill="url(#bar-grad)" opacity="0.5" />
        <rect x="15" y="19" width="5" height="15" rx="1.5" fill="url(#bar-grad)" opacity="0.7" />
        <rect x="22" y="13" width="5" height="21" rx="1.5" fill="url(#bar-grad)" opacity="0.9" />
        <rect x="29" y="8" width="5" height="26" rx="1.5" fill="url(#bar-grad)" />
        {/* Score tick at top of tallest bar */}
        <circle cx="31.5" cy="8" r="2.5" fill="#00C9A7" />
        <circle cx="31.5" cy="8" r="1.2" fill="white" />
        {/* Connector line */}
        <path
          d="M10.5 26 L17.5 19 L24.5 13 L31.5 8"
          stroke="url(#line-grad)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="2 2"
          opacity="0.6"
        />
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00C9A7" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="bar-grad" x1="0" y1="0" x2="0" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00C9A7" />
            <stop offset="100%" stopColor="#0891b2" />
          </linearGradient>
          <linearGradient id="line-grad" x1="8" y1="26" x2="31.5" y2="8" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00C9A7" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#00C9A7" stopOpacity="0.9" />
          </linearGradient>
        </defs>
      </svg>

      {showWordmark && (
        <div className="flex flex-col leading-none">
          <span
            style={{
              fontFamily: "var(--font-inter), Inter, sans-serif",
              fontWeight: 700,
              fontSize: size * 0.55,
              letterSpacing: "-0.02em",
              color: "var(--text)",
            }}
          >
            Devo
            <span style={{ color: "var(--teal)" }}>metrics</span>
          </span>
          <span
            style={{
              fontFamily: "var(--font-inter), Inter, sans-serif",
              fontWeight: 400,
              fontSize: size * 0.28,
              letterSpacing: "0.08em",
              color: "var(--text-muted)",
              textTransform: "uppercase",
            }}
          >
            by Empiric Consultancy
          </span>
        </div>
      )}
    </div>
  );
}
