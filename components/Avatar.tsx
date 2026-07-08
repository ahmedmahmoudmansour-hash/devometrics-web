const PALETTE = ["#6366f1", "#ec4899", "#3b82f6", "#a855f7", "#f97316", "#06b6d4", "#f43f5e", "#8b5cf6"];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colorFor(name: string): string {
  const hash = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return PALETTE[hash % PALETTE.length];
}

export default function Avatar({
  name,
  avatarUrl,
  size = 26,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- user-uploaded avatars, not a static asset next/image can optimize meaningfully
      <img
        src={avatarUrl}
        alt={name}
        width={size}
        height={size}
        style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
    );
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        background: colorFor(name),
        color: "#fff",
        fontSize: size * 0.4,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initials(name)}
    </span>
  );
}
