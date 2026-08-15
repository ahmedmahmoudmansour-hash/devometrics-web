"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import LocaleToggle from "./LocaleToggle";

// Hash links are prefixed with "/" so they resolve correctly from any page,
// not just the homepage — plain "#how-it-works" only works when already on
// "/", since that's the only page with a matching element id to scroll to.
// From /enterprise, /contact, etc. it silently did nothing.
// Labels come from the "common" i18n namespace (shared with Footer.tsx,
// which lists the same four product links) rather than being hardcoded
// here, so the two never drift out of translation sync.
function useNavLinks() {
  const t = useTranslations("common");
  return [
    { label: t("howItWorks"), href: "/#how-it-works" },
    { label: t("features"), href: "/#features" },
    { label: t("methodology"), href: "/#methodology" },
    { label: t("pricing"), href: "/#pricing" },
    { label: t("forEnterprise"), href: "/enterprise" },
  ];
}

export default function Navbar() {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const navLinks = useNavLinks();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav
      style={{
        position: "fixed",
        insetBlockStart: 0,
        insetInlineStart: 0,
        insetInlineEnd: 0,
        zIndex: 50,
        transition: "all 0.3s ease",
        background: scrolled ? "var(--nav-scrolled-bg)" : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: scrolled ? "1px solid var(--border)" : "1px solid transparent",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          paddingInline: 24,
          height: 72,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link href="/" style={{ textDecoration: "none" }}>
          <Logo size={40} />
        </Link>

        {/* Desktop links */}
        <div
          className="hidden md:flex"
          style={{ gap: 36, alignItems: "center" }}
        >
          {navLinks.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              style={{
                color: "var(--text-muted)",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 500,
                letterSpacing: "0.01em",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="hidden md:flex" style={{ gap: 12, alignItems: "center" }}>
          <LocaleToggle />
          <ThemeToggle />
          <Link
            href="/login"
            style={{
              color: "var(--text-muted)",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 500,
              paddingInline: 16,
              paddingBlock: 8,
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            {t("signIn")}
          </Link>
          <Link
            href="/signup"
            style={{
              background: "var(--teal)",
              color: "#0A0F1E",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 700,
              paddingInline: 20,
              paddingBlock: 9,
              borderRadius: 8,
              letterSpacing: "0.01em",
              transition: "all 0.2s",
              display: "inline-block",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--teal-dim)";
              (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(var(--teal-rgb),0.3)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--teal)";
              (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
          >
            {tCommon("getEarlyAccess")}
          </Link>
        </div>

        {/* Mobile theme toggle + hamburger */}
        <div className="flex md:hidden" style={{ alignItems: "center", gap: 8 }}>
        <LocaleToggle />
        <ThemeToggle />
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 8,
            color: "var(--text)",
          }}
          aria-label={t("toggleMenu")}
        >
          <div style={{ width: 22, display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ height: 2, background: menuOpen ? "var(--teal)" : "var(--text)", transition: "all 0.3s", transform: menuOpen ? "rotate(45deg) translateY(7px)" : "none", display: "block", borderRadius: 2 }} />
            <span style={{ height: 2, background: "var(--text)", transition: "all 0.3s", opacity: menuOpen ? 0 : 1, display: "block", borderRadius: 2 }} />
            <span style={{ height: 2, background: menuOpen ? "var(--teal)" : "var(--text)", transition: "all 0.3s", transform: menuOpen ? "rotate(-45deg) translateY(-7px)" : "none", display: "block", borderRadius: 2 }} />
          </div>
        </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          style={{
            background: "var(--nav-mobile-menu-bg)",
            backdropFilter: "blur(16px)",
            borderTop: "1px solid var(--border)",
            paddingInline: 24,
            paddingBlockStart: 20,
            paddingBlockEnd: 28,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {navLinks.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              style={{
                color: "var(--text-muted)",
                textDecoration: "none",
                fontSize: 16,
                fontWeight: 500,
                paddingBlock: 12,
                borderBottom: "1px solid var(--border)",
                transition: "color 0.2s",
              }}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/signup"
            onClick={() => setMenuOpen(false)}
            style={{
              marginTop: 16,
              background: "var(--teal)",
              color: "#0A0F1E",
              textDecoration: "none",
              fontSize: 15,
              fontWeight: 700,
              paddingInline: 24,
              paddingBlock: 14,
              borderRadius: 8,
              textAlign: "center",
              display: "block",
            }}
          >
            {tCommon("getEarlyAccess")}
          </Link>
        </div>
      )}
    </nav>
  );
}
