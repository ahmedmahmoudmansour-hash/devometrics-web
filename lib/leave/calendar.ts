// Plain helpers (no "use server") shared by the request form and the admin
// calendar settings. countWorkingDays mirrors count_leave_days() in the
// database (0194) so what the employee sees is what the database records --
// the database is still the authority (a trigger recalculates every pending
// request), this only previews it.

// ISO weekday numbers: 1 = Monday ... 7 = Sunday (same as Postgres isodow).
export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export const DEFAULT_WEEKEND_DAYS = [5, 6]; // Friday + Saturday

function isoDow(date: Date): number {
  const d = date.getUTCDay(); // 0 = Sunday
  return d === 0 ? 7 : d;
}

export function countWorkingDays(start: string, end: string, weekendDays: number[], holidayDates: string[]): number {
  if (!start || !end || end < start) return 0;
  const holidays = new Set(holidayDates);
  const weekend = new Set(weekendDays);
  const last = new Date(`${end}T00:00:00Z`);
  let count = 0;
  for (let d = new Date(`${start}T00:00:00Z`); d <= last; d = new Date(d.getTime() + 86400000)) {
    if (count > 400) break; // the database refuses > 366 days anyway
    if (weekend.has(isoDow(d))) continue;
    if (holidays.has(d.toISOString().slice(0, 10))) continue;
    count++;
  }
  return count;
}

export type PublicHoliday = { id: string; date: string; name: string };
export type LeaveCalendar = { weekendDays: number[]; holidays: PublicHoliday[] };
