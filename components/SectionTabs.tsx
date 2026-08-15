"use client";

import { useEffect, useRef, useState } from "react";

export type SectionTab = { key: string; label: string; content: React.ReactNode };

// Shared by the individual homepage ("/") and the enterprise page
// ("/enterprise") — replaces one long scroll through N sections with a tab
// bar. All panels still render server-side (only the active one is visually
// hidden via display:none, same pattern as the dashboard's TabbedSections),
// so this doesn't cost anything for SEO — a crawler still sees full
// content, only interactive visitors see the shortened page.
//
// pagePath scopes the hash-link interception to the specific page this
// instance governs (e.g. Navbar/Footer links like "/#features" are written
// with a leading "/" so they still work correctly when clicked from a
// *different* page — that click must NOT be intercepted here, it needs a
// real navigation to pagePath first). Three mechanisms, because verifying
// this live (on the original homepage instance) turned up three genuinely
// different cases, no two of which cover each other:
//  1. Landing on pagePath fresh with a hash already in the URL (a link from
//     another page, a bookmark, a shared URL) — read on mount.
//  2. Clicking a same-page hash link while ALREADY on pagePath — verified
//     live that next/link's client-side navigation updates location.hash via
//     history.pushState, which per spec never fires `hashchange` (that only
//     fires for genuine browser-driven hash navigation). A capture-phase
//     click listener intercepts the click before next/link's own handler
//     runs, so this never races against it.
//  3. A real browser-level hash change with no click involved — editing the
//     address bar, a plain (non-Link) anchor tag's default browser
//     navigation, external tool setting location.href, etc. This DOES fire
//     `hashchange` natively, which case 2's interceptor never sees (there's
//     no anchor click to intercept, or the click wasn't on pagePath) —
//     confirmed live that dropping this in favor of #2 alone broke this
//     exact case.
export default function SectionTabs({ tabs, pagePath = "/" }: { tabs: SectionTab[]; pagePath?: string }) {
  // Lazy initializer, not an effect — the initial active tab is derivable
  // synchronously from a value that's already available (the URL), so
  // this is the correct place for it per react-hooks/set-state-in-effect:
  // an effect calling setState synchronously on mount for something that
  // could've been the initial state instead just causes an extra render.
  const [active, setActive] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return tabs[0]?.key;
    const key = window.location.hash.replace("#", "");
    return tabs.some((t) => t.key === key) ? key : tabs[0]?.key;
  });
  const barRef = useRef<HTMLDivElement>(null);

  function activateAndScroll(key: string) {
    const match = tabs.find((t) => t.key === key);
    if (!match) return;
    setActive(match.key);
    // Wait a tick for the now-active panel to actually become visible —
    // scrollIntoView on a still-hidden (display:none) element is a no-op.
    requestAnimationFrame(() => {
      document.getElementById(match.key)?.scrollIntoView({ block: "start" });
    });
  }

  useEffect(() => {
    // The initial ACTIVE tab is already correct (set above) — this only
    // handles the initial SCROLL, which is a real effect (a DOM side
    // effect), not a setState call.
    if (window.location.hash && active) {
      requestAnimationFrame(() => {
        document.getElementById(active)?.scrollIntoView({ block: "start" });
      });
    }

    function onClickCapture(e: MouseEvent) {
      const anchor = (e.target as HTMLElement)?.closest?.("a[href*='#']");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      const hashIndex = href.indexOf("#");
      if (hashIndex === -1) return;
      const path = href.slice(0, hashIndex) || pagePath;
      const key = href.slice(hashIndex + 1);
      const onThisPage = window.location.pathname === pagePath;
      const targetsThisPage = path === pagePath || path === "";
      if (!onThisPage || !targetsThisPage) return; // let normal navigation happen
      if (!tabs.some((t) => t.key === key)) return; // not one of our tabs (e.g. footer social links)
      e.preventDefault();
      window.history.replaceState(null, "", `#${key}`);
      activateAndScroll(key);
    }

    function onHashChange() {
      const key = window.location.hash.replace("#", "");
      if (key) activateAndScroll(key);
    }

    document.addEventListener("click", onClickCapture, true);
    window.addEventListener("hashchange", onHashChange);
    return () => {
      document.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("hashchange", onHashChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectTab(key: string) {
    setActive(key);
    window.history.replaceState(null, "", `#${key}`);
    barRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  return (
    <div>
      <div
        ref={barRef}
        role="tablist"
        style={{
          position: "sticky",
          top: 72,
          zIndex: 30,
          background: "var(--nav-scrolled-bg, var(--navy))",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "0 24px",
            display: "flex",
            gap: 8,
            overflowX: "auto",
          }}
        >
          {tabs.map((tab) => {
            const isActive = tab.key === active;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => selectTab(tab.key)}
                style={{
                  background: "none",
                  border: "none",
                  borderBottom: isActive ? "2px solid var(--teal)" : "2px solid transparent",
                  marginBottom: -1,
                  padding: "18px 4px",
                  marginInline: 14,
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: "0.01em",
                  color: isActive ? "var(--text)" : "var(--text-muted)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "color 0.2s",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
      {tabs.map((tab) => (
        <div key={tab.key} style={{ display: tab.key === active ? "block" : "none" }}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}
