"use client";

import { useEffect, useSyncExternalStore } from "react";
import { updateTheme } from "@/app/dashboard/actions";

const STORAGE_KEY = "devometrics-theme";
type ThemeValue = "dark" | "light";

// Module-level external store (not React state) so every ThemeToggle
// instance on the page — desktop nav, mobile nav, dashboard header — stays
// in sync when any one of them is clicked, via useSyncExternalStore rather
// than calling setState from inside an effect.
let listeners: Array<() => void> = [];

function readDomTheme(): ThemeValue {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function applyTheme(next: ThemeValue) {
  if (next === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // localStorage unavailable (private browsing etc.) — theme still
    // applies for this page load via the DOM attribute above.
  }
  listeners.forEach((l) => l());
}

function subscribe(callback: () => void) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((l) => l !== callback);
  };
}

function getServerSnapshot(): ThemeValue {
  return "dark";
}

export default function ThemeToggle({ savedTheme }: { savedTheme?: string | null }) {
  const theme = useSyncExternalStore(subscribe, readDomTheme, getServerSnapshot);

  useEffect(() => {
    // If this device has no local preference yet but the signed-in profile
    // does, apply the saved one once — keeps theme in sync across devices.
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    if (!stored && savedTheme === "light") {
      applyTheme("light");
    }
  }, [savedTheme]);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    updateTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        border: "1px solid var(--border)",
        background: "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color: "var(--text-muted)",
        flexShrink: 0,
      }}
    >
      {theme === "dark" ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
