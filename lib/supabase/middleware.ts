import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && request.nextUrl.pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // First-ever landing on the bare Progress page after login, for a
  // company admin who hasn't picked a workspace before (no cookie yet) —
  // send them to the Employee/Company Administration choice instead.
  // Scoped to the exact "/dashboard" path (not every /dashboard/:path*
  // request) so this never adds a query to normal navigation, and to
  // "no cookie yet" so it only ever interrupts someone once per browser,
  // not every login — matches the memo's "reduces cognitive load" goal
  // rather than nagging on every session. Deep-linking straight to
  // /dashboard/company or any other sub-page is never intercepted here.
  if (user && request.nextUrl.pathname === "/dashboard" && !request.cookies.get("devometrics-workspace")) {
    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle<{ role: string }>();
    if (membership?.role === "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard/choose-workspace";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
