import Mascot from "./Mascot";

export default function CoachAvatar({ thinking = false, size = 28 }: { thinking?: boolean; size?: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        background: thinking ? "rgba(0,201,167,0.2)" : "rgba(0,201,167,0.14)",
        border: thinking ? "2px solid var(--teal)" : "1px solid rgba(0,201,167,0.4)",
        boxShadow: thinking ? "0 0 0 3px rgba(0,201,167,0.12)" : "none",
        flexShrink: 0,
      }}
    >
      <Mascot size={size * 0.85} />
    </span>
  );
}
