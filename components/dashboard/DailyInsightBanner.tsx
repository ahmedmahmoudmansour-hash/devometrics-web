export default function DailyInsightBanner({ insight }: { insight: string }) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, rgba(0,201,167,0.1), rgba(167,139,250,0.06))",
        border: "1px solid rgba(0,201,167,0.25)",
        borderRadius: 12,
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <span style={{ fontSize: 16 }}>✨</span>
      <p style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.5 }}>{insight}</p>
    </div>
  );
}
