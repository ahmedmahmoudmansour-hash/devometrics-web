import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

// No i18n URL routing (no /en, /ar segments) — deliberately, since that
// would mean restructuring every route under app/ and touches the
// existing middleware.ts (currently scoped to /dashboard/:path* only for
// Supabase session refresh). Locale instead comes from a plain cookie,
// which works identically for anonymous marketing-site visitors and
// logged-in dashboard users. See components/LocaleToggle.tsx for how the
// cookie gets set, and app/layout.tsx for how <html lang/dir> is derived
// from it.
export const LOCALE_COOKIE = "devometrics-locale";
export const DEFAULT_LOCALE = "en";
export const SUPPORTED_LOCALES = ["en", "ar"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export function isSupportedLocale(value: string | undefined): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

// Same cookie-first, profile-fallback priority as the getRequestConfig
// below — extracted so API route handlers (which don't go through
// next-intl's own resolution) can determine which language to have the
// model reply in, consistently with what the user actually sees in the UI.
export function resolveApiLocale(cookieValue: string | undefined, profileLanguage: string | null | undefined): Locale {
  if (isSupportedLocale(cookieValue)) return cookieValue;
  return isSupportedLocale(profileLanguage ?? undefined) ? (profileLanguage as Locale) : DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieValue = store.get(LOCALE_COOKIE)?.value;

  let locale: Locale;
  if (isSupportedLocale(cookieValue)) {
    locale = cookieValue;
  } else {
    // No explicit cookie yet (e.g. a new device) — fall back to the
    // signed-in user's saved profile preference so a returning user sees
    // their own language immediately, with no post-hydration flash the
    // way a client-only reconciliation (like ThemeToggle's) would cause,
    // since this runs server-side before the first paint. Doesn't set a
    // cookie itself — Next.js only allows that from a Server Action/Route
    // Handler, not while rendering — LocaleToggle sets it explicitly on
    // the next real toggle.
    let profileLocale: string | undefined;
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("language")
          .eq("id", user.id)
          .maybeSingle<{ language: string | null }>();
        profileLocale = profile?.language ?? undefined;
      }
    } catch {
      // Anonymous visitor, or migration 0086 not run yet — default below.
    }
    locale = isSupportedLocale(profileLocale) ? profileLocale : DEFAULT_LOCALE;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
