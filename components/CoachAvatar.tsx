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
        background: thinking ? "rgba(var(--teal-rgb),0.2)" : "rgba(var(--teal-rgb),0.14)",
        border: thinking ? "2px solid var(--teal)" : "1px solid rgba(var(--teal-rgb),0.4)",
        boxShadow: thinking ? "0 0 0 3px rgba(var(--teal-rgb),0.12)" : "none",
        flexShrink: 0,
      }}
    >
      <Mascot size={size * 0.85} />
    </span>
  );
}
