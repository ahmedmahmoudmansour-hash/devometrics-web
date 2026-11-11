"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { setMemberRole } from "@/lib/jobArchitecture/actions";
import type { PickerRole } from "@/lib/assessment/employeePicker";

const input: React.CSSProperties = { background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", padding: "8px 10px", fontSize: 13 };
const btn: React.CSSProperties = { background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" };

// Shown under an assign picker when the chosen person has no role. A company admin gives them one right here, so they do not
// have to find the Employees page and its edit dialog first. A manager cannot set roles, so they are told who can.
export default function GiveRoleInline({ name, memberId, roles, isAdmin }: { name: string; memberId: string | null; roles: PickerRole[]; isAdmin: boolean }) {
  const t = useTranslations("roleAssessment");
  const router = useRouter();
  const [roleId, setRoleId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!isAdmin) return <p style={{ fontSize: 12, color: "var(--amber)", marginTop: 8 }}>{t("giveRoleAskAdmin", { name })}</p>;
  if (roles.length === 0 || !memberId) {
    return (
      <p style={{ fontSize: 12, color: "var(--amber)", marginTop: 8 }}>
        {t("noRolesYet")}{" "}
        <Link href="/dashboard/company/job-architecture" style={{ color: "var(--teal)", fontWeight: 700, textDecoration: "none" }}>
          {t("openJobArchitecture")}
        </Link>
      </p>
    );
  }

  function save() {
    if (!roleId || !memberId) return;
    setError(null);
    startTransition(async () => {
      const r = await setMemberRole(memberId, roleId);
      if (r && "error" in r && r.error) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div style={{ marginTop: 10, padding: 12, border: "1px solid var(--border)", borderRadius: 12 }}>
      <p style={{ fontSize: 13, color: "var(--text)", margin: 0 }}>{t("giveRoleTitle", { name })}</p>
      <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select value={roleId} onChange={(e) => setRoleId(e.target.value)} style={{ ...input, minWidth: 240 }} aria-label={t("chooseRole")} disabled={pending}>
          <option value="">{t("chooseRole")}</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
              {r.level ? ` — ${r.level}` : ""}
            </option>
          ))}
        </select>
        <button type="button" style={{ ...btn, opacity: !roleId || pending ? 0.6 : 1 }} disabled={!roleId || pending} onClick={save}>
          {pending ? t("savingRole") : t("giveRole")}
        </button>
      </div>
      {error && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{error}</p>}
    </div>
  );
}
