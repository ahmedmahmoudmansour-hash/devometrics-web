import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Lets a platform admin confirm error monitoring end to end after setting the
// DSN: POST here and the error should appear in the Sentry project within a
// minute. Platform-admin only, so it cannot be used to flood the project.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle<{ is_admin: boolean }>();
  if (!profile?.is_admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  Sentry.captureException(new Error("Devometrics monitoring test event (safe to ignore)"));
  await Sentry.flush(2000);
  return NextResponse.json({ sent: true });
}
