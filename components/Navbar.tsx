"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

// Hash links are prefixed with "/" so they resolve correctly from any page,
// not just the homepage — plain "#how-it-works" only works when already on
// "/", since that's the only page with a matching element id to scroll to.
// From /enterprise, /contact, etc. it silently did nothing.
const navLinks = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Features", href: "/#features" },
  { label: "Methodology", href: "/#methodology" },
  { label: "Pricing", href: "/#pricing" },
  { label: "For Enterprise", href: "/enterprise" },
];

export default function Navbar() {
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
        top: 0,
        left: 0,
        right: 0,
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
          padding: "0 24px",
          height: 72,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link href="/" style={{ textDecoration: "none" }}>
          <Logo size={32} />
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
          <ThemeToggle />
          <Link
            href="/login"
            style={{
              color: "var(--text-muted)",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 500,
              padding: "8px 16px",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            style={{
              background: "var(--teal)",
              color: "#0A0F1E",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 700,
              padding: "9px 20px",
              borderRadius: 8,
              letterSpacing: "0.01em",
              transition: "all 0.2s",
              display: "inline-block",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--teal-dim)";
              (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(0,201,167,0.3)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--teal)";
              (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
          >
            Get early access
          </Link>
        </div>

        {/* Mobile theme toggle + hamburger */}
        <div className="flex md:hidden" style={{ alignItems: "center", gap: 8 }}>
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
          aria-label="Toggle menu"
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
            padding: "20px 24px 28px",
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
                padding: "12px 0",
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
              padding: "14px 24px",
              borderRadius: 8,
              textAlign: "center",
              display: "block",
            }}
          >
            Get early access
          </Link>
        </div>
      )}
    </nav>
  );
}
