import Link from "next/link";
import type { Milestone } from "@/lib/supabase/types";

const WINDOW_DAYS = 7;

// In-app reminder, no email/push infrastructure needed — surfaces any
// milestone due within a week right where the user already looks every day.
// Real push/email reminders are a separate, bigger project (service worker +
// VAPID keys for push; Resend + a verified domain for email) — this covers
// "don't let me miss something" today without waiting on either.
export default function UpcomingDeadlinesCard({ milestones }: { milestones: Milestone[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + WINDOW_DAYS);

  const upcoming = milestones
    .filter((m) => !m.completed && m.target_date)
    .filter((m) => {
      const d = new Date(m.target_date as string);
      return d >= today && d <= cutoff;
    })
    .sort((a, b) => (a.target_date as string).localeCompare(b.target_date as string));

  if (upcoming.length === 0) return null;

  return (
    <div style={{ background: "rgba(240,184,64,0.06)", border: "1px solid rgba(240,184,64,0.25)", borderRadius: 16, padding: 20 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: "#f0b840", marginBottom: 10 }}>
        🔔 Due in the next {WINDOW_DAYS} days
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {upcoming.map((m) => (
          <div key={m.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: "var(--text)" }}>{m.title}</span>
            <span style={{ color: "var(--text-muted)" }}>{m.target_date}</span>
          </div>
        ))}
      </div>
      <Link href="/dashboard/tasks" style={{ fontSize: 12, color: "var(--teal)", marginTop: 10, display: "inline-block" }}>
        Break these into daily tasks →
      </Link>
    </div>
  );
}
