import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import CoachScheduleReminder from "@/components/dashboard/CoachScheduleReminder";

export const metadata = { title: "Book a Coaching Session — Devometrics" };

// Booking lives on its own page so the coaching page itself is only the
// conversation — scheduling controls mixed into the chat screen made both
// jobs harder to find (user feedback: "separate booking from coaching").
export default async function CoachBookingPage() {
  const t = await getTranslations("coachBookPage");
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
            {t("backToCoaching")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            {t("title")}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6 }}>
            {t("subtitle")}
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
            {t("readyNow")}
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
            {t("joinSessionNow")}
          </Link>
        </div>
      </div>
    </div>
  );
}
