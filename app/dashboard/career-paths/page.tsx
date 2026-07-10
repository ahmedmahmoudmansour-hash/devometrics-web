import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CareerPathsView from "@/components/dashboard/CareerPathsView";
import type { CareerPaths } from "@/lib/supabase/types";

export const metadata = { title: "Career Paths — Devometrics" };

export default async function CareerPathsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // error is non-null when migration 0049 hasn't been run (missing table) —
  // show a setup notice instead of a broken page.
  const { data: saved, error } = await supabase
    .from("career_paths")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<CareerPaths>();

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← Back to progress
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            Career Paths
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 640 }}>
            Where you can realistically go from here — mapped from your actual profile, gap
            analysis, and stated ambitions. Each role shows how ready you are today, what it
            requires, and what would close the distance. A decision aid, not a verdict.
          </p>
        </div>

        {error ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
              Career Paths isn&apos;t enabled on this database yet — the{" "}
              <code style={{ color: "var(--teal)" }}>0049_notes_career_paths_hr_fields.sql</code> migration
              needs to be run in the Supabase SQL Editor first.
            </p>
          </div>
        ) : (
          <CareerPathsView saved={saved ?? null} />
        )}
      </div>
    </div>
  );
}
