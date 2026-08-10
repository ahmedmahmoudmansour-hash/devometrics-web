// Shared blocked-state block for a feature an org admin has restricted via
// organization_feature_restrictions — same visual convention as the
// existing "migration not run yet" notices (e.g. career-paths/page.tsx),
// reused here so a restriction reads as a deliberate, explained state
// rather than a broken page.
export default function FeatureRestrictedNotice({ message }: { message: string }) {
  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
      <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>{message}</p>
    </div>
  );
}
