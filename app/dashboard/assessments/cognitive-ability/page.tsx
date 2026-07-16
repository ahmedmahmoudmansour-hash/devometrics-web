import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CognitiveAbilityForm from "@/components/dashboard/CognitiveAbilityForm";

export const metadata = { title: "Cognitive Reasoning — Devometrics" };

export default async function CognitiveAbilityPage() {
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
            Cognitive Reasoning
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
            A numerical, verbal, and logical reasoning exercise with real correct answers — guidance
            for your own development, not intended for hiring, promotion, or any other decision.
          </p>
        </div>
        <CognitiveAbilityForm />
      </div>
    </div>
  );
}
