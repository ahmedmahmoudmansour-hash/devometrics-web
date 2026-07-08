import Link from "next/link";

export default function CompanyNavTabs({ active }: { active: "profile" | "employees" | "surveys" }) {
  const tabs: { key: "profile" | "employees" | "surveys"; label: string; href: string }[] = [
    { key: "profile", label: "Profile", href: "/dashboard/company" },
    { key: "employees", label: "Employees", href: "/dashboard/company/employees" },
    { key: "surveys", label: "Surveys", href: "/dashboard/company/surveys" },
  ];

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 24, borderBottom: "1px solid var(--border)" }}>
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          style={{
            padding: "10px 4px",
            marginBottom: -1,
            fontSize: 14,
            fontWeight: 700,
            textDecoration: "none",
            color: active === tab.key ? "var(--teal)" : "var(--text-muted)",
            borderBottom: active === tab.key ? "2px solid var(--teal)" : "2px solid transparent",
          }}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
