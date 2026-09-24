"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Attendance (0182). RLS does the access control: admins see/manage the whole
// company, an employee sees their own days, a manager sees their direct
// reports'. Employees never write history directly — only the two check-in /
// check-out functions can, and only for today (± 1 day for time zones).

export type AttendanceStatus = "present" | "late" | "remote" | "absent" | "holiday";

export type AttendanceRecord = {
  id: string;
  userId: string;
  workDate: string;
  status: AttendanceStatus;
  checkIn: string | null;
  checkOut: string | null;
  source: "import" | "self";
  notes: string | null;
};

type RawRecord = {
  id: string; user_id: string; work_date: string; status: string; check_in: string | null; check_out: string | null; source: string; notes: string | null;
};

const COLUMNS = "id, user_id, work_date, status, check_in, check_out, source, notes";

function mapRecord(r: RawRecord): AttendanceRecord {
  return {
    id: r.id, userId: r.user_id, workDate: r.work_date, status: r.status as AttendanceStatus,
    // Postgres returns HH:MM:SS — the UI only needs HH:MM.
    checkIn: r.check_in ? r.check_in.slice(0, 5) : null, checkOut: r.check_out ? r.check_out.slice(0, 5) : null,
    source: r.source === "self" ? "self" : "import", notes: r.notes,
  };
}

function monthRange(month: string): { from: string; to: string } | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const [y, m] = month.split("-").map(Number);
  if (m < 1 || m > 12) return null;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

// A month of attendance. For an admin this is the whole company (RLS);
// anyone else only ever gets what they're allowed to see.
export async function listAttendanceForMonth(organizationId: string, month: string): Promise<AttendanceRecord[]> {
  const range = monthRange(month);
  if (!range) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance_records")
    .select(COLUMNS)
    .eq("organization_id", organizationId)
    .gte("work_date", range.from)
    .lte("work_date", range.to)
    .order("work_date", { ascending: false })
    .limit(5000)
    .returns<RawRecord[]>();
  return (data ?? []).map(mapRecord);
}

export async function listMyAttendance(month: string): Promise<AttendanceRecord[]> {
  const range = monthRange(month);
  if (!range) return [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("attendance_records")
    .select(COLUMNS)
    .eq("user_id", user.id)
    .gte("work_date", range.from)
    .lte("work_date", range.to)
    .order("work_date", { ascending: false })
    .returns<RawRecord[]>();
  return (data ?? []).map(mapRecord);
}

// localDate/localTime come from the employee's device (there is no GPS or
// hardware check) — the database refuses dates more than a day from today.
export async function checkIn(localDate: string, localTime: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("attendance_check_in", { p_work_date: localDate, p_time: localTime });
  if (error) {
    console.error("checkIn failed:", error);
    return { error: "Could not check in — the database may need migration 0182 run first." };
  }
  revalidatePath("/dashboard/leave");
  return { success: true };
}

export async function checkOut(localDate: string, localTime: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("attendance_check_out", { p_work_date: localDate, p_time: localTime });
  if (error) {
    return { error: error.message?.includes("No check-in") ? "Check in first, then check out." : "Could not check out." };
  }
  revalidatePath("/dashboard/leave");
  return { success: true };
}

// Admin correction: remove a day (then re-import or leave it blank).
export async function deleteAttendanceRecord(id: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("attendance_records").delete().eq("id", id).select("id");
  if (error || !data || data.length === 0) return { error: "Could not remove this record." };
  revalidatePath("/dashboard/company/attendance");
  return { success: true };
}
