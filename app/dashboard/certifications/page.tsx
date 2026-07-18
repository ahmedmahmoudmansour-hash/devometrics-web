import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listCertifications } from "@/lib/certifications/actions";
import CertificationsView from "@/components/dashboard/CertificationsView";

export const metadata = { title: "Certifications — Devometrics" };

export default async function CertificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { certifications, error } = await listCertifications();

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← Back to progress
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            Certifications
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 640 }}>
            Keep your credentials in one place with expiry reminders — never let one lapse without
            noticing.
          </p>
        </div>

        {error ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
              Certifications isn&apos;t enabled on this database yet — the{" "}
              <code style={{ color: "var(--teal)" }}>0074_certifications.sql</code> migration needs to be
              run in the Supabase SQL Editor first.
            </p>
          </div>
        ) : (
          <CertificationsView initial={certifications} />
        )}
      </div>
    </div>
  );
}
