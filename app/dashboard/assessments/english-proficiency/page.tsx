import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EnglishProficiencyForm from "@/components/dashboard/EnglishProficiencyForm";

export const metadata = { title: "English Proficiency — Devometrics" };

export default async function EnglishProficiencyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard/assessments" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← All assessments
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            English Proficiency
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
            A CEFR-style level test (A1–C2) — grammar, vocabulary, and reading comprehension with real
            correct answers, not a self-rating.
          </p>
        </div>
        <EnglishProficiencyForm />
      </div>
    </div>
  );
}
