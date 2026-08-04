"use server";

import { createClient } from "@/lib/supabase/server";

// Lazy, org-chart-only query — deliberately NOT folded into WorkforceRow/
// buildCompanyData(), which many unrelated pages (Employees, Team Pulse,
// Analytics, ...) consume and shouldn't pay this join for. A simple
// boolean signal only: "nominated for at least one succession role" —
// never the Flight Risk Score, which stays out of this feature entirely
// (HR-internal/admin-only by design, not something to surface on a
// browsable chart card without its own separate, deliberate decision).
export async function getNominatedUserIds(organizationId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data: roles } = await supabase
    .from("succession_roles")
    .select("id")
    .eq("organization_id", organizationId)
    .returns<{ id: string }[]>();
  const roleIds = (roles ?? []).map((r) => r.id);
  if (roleIds.length === 0) return new Set();

  const { data: nominations } = await supabase
    .from("succession_nominations")
    .select("employee_user_id")
    .in("role_id", roleIds)
    .returns<{ employee_user_id: string }[]>();

  return new Set((nominations ?? []).map((n) => n.employee_user_id));
}
