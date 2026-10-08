"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_WEEKEND_DAYS, type LeaveCalendar } from "@/lib/leave/calendar";

// organizations.weekend_days + public_holidays (0194). Everyone in a company
// reads it (the request form previews the day count from it); only org admins
// change it (RLS).
export async function getLeaveCalendar(organizationId: string): Promise<LeaveCalendar> {
  const supabase = await createClient();
  const [{ data: org }, { data: hol }] = await Promise.all([
    supabase.from("organizations").select("weekend_days").eq("id", organizationId).maybeSingle<{ weekend_days: number[] | null }>(),
    supabase
      .from("public_holidays")
      .select("id, holiday_date, name")
      .eq("organization_id", organizationId)
      .order("holiday_date", { ascending: true })
      .returns<{ id: string; holiday_date: string; name: string }[]>(),
  ]);
  return {
    weekendDays: org?.weekend_days ?? DEFAULT_WEEKEND_DAYS,
    holidays: (hol ?? []).map((h) => ({ id: h.id, date: h.holiday_date, name: h.name })),
  };
}

export async function setWeekendDays(organizationId: string, days: number[]): Promise<{ error: string } | { success: true }> {
  const clean = [...new Set(days)].filter((d) => Number.isInteger(d) && d >= 1 && d <= 7).sort();
  if (clean.length > 6) return { error: "At least one day of the week must be a working day." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("organizations").update({ weekend_days: clean }).eq("id", organizationId).select("id");
  if (error) {
    console.error("setWeekendDays failed:", error);
    return { error: "Could not save — the database may need migration 0194 run first." };
  }
  if (!data || data.length === 0) return { error: "Only a company admin can change this." };
  revalidatePath("/dashboard/company/leave");
  revalidatePath("/dashboard/leave");
  return { success: true };
}

export async function addPublicHoliday(organizationId: string, date: string, name: string): Promise<{ error: string } | { success: true; id: string }> {
  const trimmed = name.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return { error: "Choose a valid date" };
  if (!trimmed) return { error: "Give the holiday a name" };
  if (trimmed.length > 100) return { error: "Keep the name under 100 characters" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { data, error } = await supabase
    .from("public_holidays")
    .insert({ organization_id: organizationId, holiday_date: date, name: trimmed, created_by: user.id })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) {
    if (error?.code === "23505") return { error: "There is already a holiday on that date." };
    console.error("addPublicHoliday failed:", error);
    return { error: "Could not save — the database may need migration 0194 run first." };
  }
  revalidatePath("/dashboard/company/leave");
  revalidatePath("/dashboard/leave");
  return { success: true, id: data.id };
}

export async function removePublicHoliday(id: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("public_holidays").delete().eq("id", id).select("id");
  if (error || !data || data.length === 0) return { error: "Could not remove this holiday" };
  revalidatePath("/dashboard/company/leave");
  revalidatePath("/dashboard/leave");
  return { success: true };
}
