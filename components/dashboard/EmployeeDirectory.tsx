"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Mail, Phone, Smartphone, Hash, Search } from "lucide-react";
import Avatar from "@/components/Avatar";
import { updateMyContactInfo, type DirectoryEntry } from "@/lib/directory/actions";

const cardStyle: React.CSSProperties = { background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 };
const fieldStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 14,
  color: "var(--text)",
  outline: "none",
  width: "100%",
};
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, display: "block" };

// Two-part page: a searchable grid of everyone in the company (the actual
// "help people find and contact each other" ask), and a small self-service
// form for the three contact fields an employee owns (phone/mobile/
// extension) — the rest of what a card shows (name, title, department,
// manager) already comes from elsewhere in the app, not editable here.
export default function EmployeeDirectory({ entries, myUserId }: { entries: DirectoryEntry[]; myUserId: string }) {
  const t = useTranslations("employeeDirectory");
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const me = entries.find((e) => e.userId === myUserId);
  const [phone, setPhone] = useState(me?.phone ?? "");
  const [mobilePhone, setMobilePhone] = useState(me?.mobilePhone ?? "");
  const [extension, setExtension] = useState(me?.extension ?? "");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function handleSaveContactInfo(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateMyContactInfo({ phone, mobilePhone, extension });
      if ("error" in result) setSaveError(result.error);
      else setSaved(true);
    });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      [e.name, e.email, e.title, e.department, e.managerName].some((field) => field?.toLowerCase().includes(q))
    );
  }, [entries, query]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => a.name.localeCompare(b.name)), [filtered]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={cardStyle}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{t("myContactTitle")}</h2>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>{t("myContactDescription")}</p>
        <form onSubmit={handleSaveContactInfo}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>{t("phoneLabel")}</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("phonePlaceholder")} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>{t("mobileLabel")}</label>
              <input value={mobilePhone} onChange={(e) => setMobilePhone(e.target.value)} placeholder={t("mobilePlaceholder")} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>{t("extensionLabel")}</label>
              <input value={extension} onChange={(e) => setExtension(e.target.value)} placeholder={t("extensionPlaceholder")} style={fieldStyle} />
            </div>
          </div>
          <button
            type="submit"
            disabled={isPending}
            style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}
          >
            {isPending ? t("saving") : t("saveButton")}
          </button>
          {saved && <span style={{ color: "var(--teal)", fontSize: 13, marginInlineStart: 12 }}>{t("saved")}</span>}
          {saveError && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{saveError}</p>}
        </form>
      </div>

      <div style={cardStyle}>
        <div style={{ position: "relative", marginBottom: 20 }}>
          <Search size={16} style={{ position: "absolute", insetInlineStart: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            style={{ ...fieldStyle, paddingInlineStart: 40 }}
          />
        </div>

        {sorted.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("noResults")}</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
            {sorted.map((entry) => (
              <div
                key={entry.userId}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  background: entry.userId === myUserId ? "rgba(var(--teal-rgb),0.06)" : "transparent",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar name={entry.name} avatarUrl={entry.avatarUrl} size={38} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {entry.name}
                    </p>
                    {entry.title && (
                      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {entry.title}
                      </p>
                    )}
                  </div>
                </div>

                {entry.department && (
                  <span
                    style={{
                      alignSelf: "flex-start",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.08)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {entry.department}
                  </span>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
                  <a href={`mailto:${entry.email}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "inherit", textDecoration: "none" }}>
                    <Mail size={13} /> <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.email}</span>
                  </a>
                  {entry.phone && (
                    <a href={`tel:${entry.phone}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "inherit", textDecoration: "none" }}>
                      <Phone size={13} /> {entry.phone}
                    </a>
                  )}
                  {entry.mobilePhone && (
                    <a href={`tel:${entry.mobilePhone}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "inherit", textDecoration: "none" }}>
                      <Smartphone size={13} /> {entry.mobilePhone}
                    </a>
                  )}
                  {entry.extension && (
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Hash size={13} /> {t("extensionShort", { ext: entry.extension })}
                    </span>
                  )}
                </div>

                {entry.managerName && (
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                    {t("reportsTo", { manager: entry.managerName })}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
