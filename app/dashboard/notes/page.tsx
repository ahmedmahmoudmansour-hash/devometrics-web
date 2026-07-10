import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NotesWorkspace from "@/components/dashboard/NotesWorkspace";
import type { PersonalNote } from "@/lib/supabase/types";

export const metadata = { title: "Workspace — Devometrics" };

export default async function NotesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // error is non-null if migration 0049 hasn't been run yet (missing
  // table) — render a setup notice instead of a broken page.
  const { data: notes, error } = await supabase
    .from("personal_notes")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .returns<PersonalNote[]>();

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← Back to progress
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            Workspace
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6 }}>
            Your private thinking space — notes, ideas, observations. The AI can organize a note
            into a summary and concrete action items, and any action item can become a real task
            with one click. Only you can see what&apos;s here.
          </p>
        </div>

        {error ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
              The Workspace isn&apos;t enabled on this database yet — the{" "}
              <code style={{ color: "var(--teal)" }}>0049_notes_career_paths_hr_fields.sql</code> migration
              needs to be run in the Supabase SQL Editor first.
            </p>
          </div>
        ) : (
          <NotesWorkspace initialNotes={notes ?? []} />
        )}
      </div>
    </div>
  );
}
