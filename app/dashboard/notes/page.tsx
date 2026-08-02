import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
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

  const t = await getTranslations("notesWorkspace");

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
            {t("backToProgress")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            {t("title")}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6 }}>
            {t("subtitle")}
          </p>
        </div>

        {error ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
              {t("migrationNoticeBefore")}{" "}
              <code style={{ color: "var(--teal)" }}>0049_notes_career_paths_hr_fields.sql</code>{" "}
              {t("migrationNoticeAfter")}
            </p>
          </div>
        ) : (
          <NotesWorkspace initialNotes={notes ?? []} />
        )}
      </div>
    </div>
  );
}
