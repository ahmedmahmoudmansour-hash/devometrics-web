"use client";

import { createContext, useContext } from "react";
import type { EmployeeNavFlags } from "@/components/dashboard/employeeNav";

// The dashboard layout already looks all of this up once per request for
// the sidebar; this hands the same values to anything on the page (the home
// tile hub) so it doesn't repeat those queries.
export type DashboardNavValue = EmployeeNavFlags & { isFreeTier: boolean };

const DashboardNavContext = createContext<DashboardNavValue | null>(null);

export function DashboardNavProvider({ value, children }: { value: DashboardNavValue; children: React.ReactNode }) {
  return <DashboardNavContext.Provider value={value}>{children}</DashboardNavContext.Provider>;
}

export function useDashboardNav(): DashboardNavValue | null {
  return useContext(DashboardNavContext);
}
