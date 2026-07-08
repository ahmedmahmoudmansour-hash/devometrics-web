import Link from "next/link";
import { redirect } from "next/navigation";
import { buildEmployeeDetail } from "@/lib/organizations/aggregate";
import AssignTaskForm from "@/components/dashboard/AssignTaskForm";
import Avatar from "@/components/Avatar";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const data = await buildEmployeeDetail(userId);
  if (!data.isAuthorized || !data.profile) redirect("/dashboard/company");

  const { profile, plans } = data;

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link href="/dashboard/company/employees" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
          ← Back to employees
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12, marginBottom: 28 }}>
          <Avatar name={profile.name} avatarUrl={profile.avatarUrl} size={44} />
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>{profile.name}</h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
              {[profile.title, profile.email].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>

        <AssignTaskForm employeeUserId={userId} plans={plans.map((p) => ({ id: p.id, title: p.title }))} />

        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Development plans</h2>
          {plans.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              No development plans yet — assigning a task above will create one.
            </p>
          ) : (
            plans.map((plan) => (
              <div
                key={plan.id}
                style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}
              >
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>{plan.title}</h3>
                {plan.milestones.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No tasks yet.</p>
                ) : (
                  plan.milestones
                    .sort((a, b) => a.position - b.position)
                    .map((m) => (
                      <div key={m.id} style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                          <span
                            style={{
                              fontSize: 13,
                              color: m.completed ? "var(--text-muted)" : "var(--text)",
                              textDecoration: m.completed ? "line-through" : "none",
                            }}
                          >
                            {m.title}
                          </span>
                          {m.assigned_by && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: "var(--teal)",
                                background: "rgba(0,201,167,0.1)",
                                border: "1px solid rgba(0,201,167,0.3)",
                                borderRadius: 999,
                                padding: "3px 10px",
                                whiteSpace: "nowrap",
                                textTransform: "uppercase",
                                letterSpacing: "0.04em",
                              }}
                            >
                              Assigned by you
                            </span>
                          )}
                        </div>
                        {m.description && (
                          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5 }}>
                            {m.description}
                          </p>
                        )}
                      </div>
                    ))
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
