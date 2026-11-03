// HR administration modules (leave, attendance, HR letters, compensation) are HIDDEN FOR NOW.
//
// Decision (3 Nov 2026): the product keeps its focus on talent intelligence, learning and appraisal. The HR
// administration modules stay in the code and the database exactly as they are, nothing is deleted, but they do not
// appear in navigation, hubs or settings, and their pages send people back to the dashboard.
//
// To show them again, set NEXT_PUBLIC_SHOW_HR_MODULES=1 in the environment and redeploy. One switch, one place.

export const HR_MODULES_VISIBLE = process.env.NEXT_PUBLIC_SHOW_HR_MODULES === "1";

export function hrModulesHidden(): boolean {
  return !HR_MODULES_VISIBLE;
}

// Company feature keys that belong to the hidden HR administration area (the whole "Time & Pay" tile).
export const HIDDEN_HR_FEATURE_KEYS = ["leave", "attendance", "compensation"] as const;

// The employee "Services" page (time off, attendance and HR letters).
export const HIDDEN_HR_EMPLOYEE_HREFS = ["/dashboard/leave"] as const;
