"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCircle, Building2, ArrowRight } from "lucide-react";

const WORKSPACE_COOKIE = "devometrics-workspace";

function cardStyle(hovered: boolean): React.CSSProperties {
  return {
    flex: 1,
    minWidth: 260,
    background: "var(--navy-mid)",
    border: hovered ? "1px solid var(--teal)" : "1px solid var(--border)",
    borderRadius: 16,
    padding: 28,
    cursor: "pointer",
    textAlign: "left",
    transition: "border-color 0.15s, transform 0.15s",
    transform: hovered ? "translateY(-2px)" : "none",
  };
}

export default function ChooseWorkspaceCards({
  employeeTitle,
  employeeDescription,
  adminTitle,
  adminDescription,
  rememberNote,
}: {
  employeeTitle: string;
  employeeDescription: string;
  adminTitle: string;
  adminDescription: string;
  rememberNote: string;
}) {
  const router = useRouter();
  const [hovered, setHovered] = useState<"employee" | "admin" | null>(null);
  const [navigating, setNavigating] = useState(false);

  function choose(workspace: "employee" | "admin") {
    setNavigating(true);
    // Plain, non-httpOnly cookie — same convention as the locale/theme
    // preference cookies already set client-side elsewhere (see
    // LocaleToggle) — read server-side by middleware on the next request
    // so this choice is never asked again on this browser, only via the
    // explicit "Switch workspace" sidebar link.
    document.cookie = `${WORKSPACE_COOKIE}=${workspace}; path=/; max-age=31536000; samesite=lax`;
    router.push(workspace === "admin" ? "/dashboard/company" : "/dashboard");
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => choose("employee")}
          onMouseEnter={() => setHovered("employee")}
          onMouseLeave={() => setHovered(null)}
          disabled={navigating}
          style={cardStyle(hovered === "employee")}
        >
          <UserCircle size={28} style={{ color: "var(--teal)", marginBottom: 14 }} />
          <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{employeeTitle}</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 14 }}>{employeeDescription}</p>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--teal)" }}>
            {employeeTitle} <ArrowRight size={14} />
          </span>
        </button>

        <button
          type="button"
          onClick={() => choose("admin")}
          onMouseEnter={() => setHovered("admin")}
          onMouseLeave={() => setHovered(null)}
          disabled={navigating}
          style={cardStyle(hovered === "admin")}
        >
          <Building2 size={28} style={{ color: "var(--amber)", marginBottom: 14 }} />
          <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{adminTitle}</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 14 }}>{adminDescription}</p>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--amber)" }}>
            {adminTitle} <ArrowRight size={14} />
          </span>
        </button>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>{rememberNote}</p>
    </div>
  );
}
