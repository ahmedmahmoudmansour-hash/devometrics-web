import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CoachScheduleReminder from "@/components/dashboard/CoachScheduleReminder";

export const metadata = { title: "Book a Coaching Session — Devometrics" };

// Booking lives on its own page so the coaching page itself is only the
// conversation — scheduling controls mixed into the chat screen made both
// jobs harder to find (user feedback: "separate booking from coaching").
export default async function CoachBookingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard/coach" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← Back to coaching
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            Book coaching sessions
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6 }}>
            Set a recurring cadence and add it to your own calendar — most people get the most out
            of a 30–45 minute session weekly or every two weeks. Your coach is available anytime,
            so a booked slot is a commitment to yourself, not a queue.
          </p>
        </div>

        <CoachScheduleReminder />

        <div
          style={{
            background: "var(--navy-mid)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: 20,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Ready now? You don&apos;t need an appointment to start.
          </p>
          <Link
            href="/dashboard/coach"
            style={{
              background: "var(--teal)",
              color: "#0A0F1E",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 700,
              padding: "10px 18px",
              borderRadius: 8,
              whiteSpace: "nowrap",
            }}
          >
            Join session now →
          </Link>
        </div>
      </div>
    </div>
  );
}
