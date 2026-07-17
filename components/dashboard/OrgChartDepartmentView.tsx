import Link from "next/link";
import Avatar from "@/components/Avatar";
import type { WorkforceRow } from "@/lib/organizations/aggregate";

// The function/department view — deliberately NOT a hierarchy. Grouping by
// department answers "who's in Engineering" rather than "who reports to
// whom"; those are two different, both-legitimate questions an org chart
// tool needs to answer, which is exactly why this is a second view rather
// than a filter bolted onto the reporting tree.
export default function OrgChartDepartmentView({ rows }: { rows: WorkforceRow[] }) {
  const byDept = new Map<string, WorkforceRow[]>();
  for (const r of rows) {
    const key = r.department ?? "Unassigned";
    const list = byDept.get(key) ?? [];
    list.push(r);
    byDept.set(key, list);
  }
  const groups = [...byDept.entries()].sort((a, b) => {
    if (a[0] === "Unassigned") return 1;
    if (b[0] === "Unassigned") return -1;
    return a[0].localeCompare(b[0]);
  });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
      {groups.map(([dept, members]) => (
        <div key={dept} style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
          <h3 style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{dept}</h3>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
            {members.length} {members.length === 1 ? "person" : "people"}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {members
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((m) => (
                <Link
                  key={m.userId}
                  href={`/dashboard/company/${m.userId}`}
                  style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}
                >
                  <Avatar name={m.name} avatarUrl={m.avatarUrl} size={26} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{m.name}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{m.title ?? "No title"}</p>
                  </div>
                </Link>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
