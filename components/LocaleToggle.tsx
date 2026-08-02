"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { updateLanguage } from "@/app/dashboard/actions";

// Must match LOCALE_COOKIE in lib/i18n/request.ts.
const LOCALE_COOKIE = "devometrics-locale";

// Rendered in the dashboard sidebar (components/dashboard/SidebarNav.tsx)
// and the public marketing Navbar (components/Navbar.tsx) — safe for a
// logged-out visitor since updateLanguage() below no-ops without a user.
//
// Unlike ThemeToggle (a pure client-side CSS-variable flip, no reload
// needed), switching locale changes server-rendered translated content,
// so this has to trigger a real refetch via router.refresh() after
// setting the cookie next-intl reads server-side.
export default function LocaleToggle() {
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = locale === "ar" ? "en" : "ar";
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => {
      router.refresh();
    });
    updateLanguage(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-label={locale === "ar" ? "Switch to English" : "التبديل إلى العربية"}
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        border: "1px solid var(--border)",
        background: "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: isPending ? "wait" : "pointer",
        color: "var(--text-muted)",
        fontSize: 12,
        fontWeight: 700,
        flexShrink: 0,
        opacity: isPending ? 0.6 : 1,
      }}
    >
      {locale === "ar" ? "EN" : "عربي"}
    </button>
  );
}
