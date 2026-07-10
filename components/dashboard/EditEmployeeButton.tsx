"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMemberDetails, setMemberArchived } from "@/lib/organizations/actions";

const fieldStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 13,
  color: "var(--text)",
  outline: "none",
};

export default function EditEmployeeButton({
  memberId,
  name,
  initial,
}: {
  memberId: string | null;
  name: string;
  initial: {
    title: string | null;
    department: string | null;
    country: string | null;
    managerName: string | null;
    managerEmail: string | null;
    businessUnit: string | null;
    location: string | null;
  };
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initial.title ?? "");
  const [department, setDepartment] = useState(initial.department ?? "");
  const [country, setCountry] = useState(initial.country ?? "");
  const [managerName, setManagerName] = useState(initial.managerName ?? "");
  const [managerEmail, setManagerEmail] = useState(initial.managerEmail ?? "");
  const [businessUnit, setBusinessUnit] = useState(initial.businessUnit ?? "");
  const [location, setLocation] = useState(initial.location ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // memberId is null only before migration 0049 is run — show nothing
  // rather than a button that can't work.
  if (!memberId) return null;

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateMemberDetails(memberId!, {
        title,
        department,
        country,
        manager_name: managerName,
        manager_email: managerEmail,
        business_unit: businessUnit,
        location,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      setOpen(false);
    });
  }

  function archive() {
    setError(null);
    startTransition(async () => {
      const result = await setMemberArchived(memberId!, true);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: "none",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "4px 10px",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-muted)",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Edit
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(3,8,16,0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 24,
          }}
        >
          <div
            style={{
              background: "var(--navy-mid)",
              border: "1px solid rgba(0,201,167,0.3)",
              borderRadius: 20,
              padding: 28,
              maxWidth: 480,
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "0 20px 80px rgba(0,0,0,0.5)",
            }}
          >
            <h2 style={{ fontSize: 17, fontWeight: 800, color: "var(--text)", marginBottom: 16 }}>
              Edit {name}
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
                Job title
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={fieldStyle} />
              </label>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
                Department
                <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} style={fieldStyle} />
              </label>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
                Business unit
                <input type="text" value={businessUnit} onChange={(e) => setBusinessUnit(e.target.value)} style={fieldStyle} />
              </label>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
                Manager
                <input type="text" value={managerName} onChange={(e) => setManagerName(e.target.value)} style={fieldStyle} />
              </label>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
                Manager email
                <input type="email" value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)} style={fieldStyle} />
              </label>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
                Country
                <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} style={fieldStyle} />
              </label>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
                Location / city
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} style={fieldStyle} />
              </label>
            </div>

            {error && <p style={{ color: "#f87171", fontSize: 12, marginTop: 12, lineHeight: 1.5 }}>{error}</p>}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={archive}
                disabled={isPending}
                style={{
                  background: "rgba(248,113,113,0.1)",
                  border: "1px solid rgba(248,113,113,0.35)",
                  borderRadius: 8,
                  padding: "9px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#f87171",
                  cursor: "pointer",
                }}
              >
                Archive employee
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                  style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, color: "var(--text-muted)", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={isPending}
                  style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}
                >
                  {isPending ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12, lineHeight: 1.5 }}>
              Archiving removes them from workforce views and analytics but keeps their history — it
              doesn&apos;t delete their account or data.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
