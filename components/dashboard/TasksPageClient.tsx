"use client";

import { useState } from "react";
import CalendarView from "@/components/dashboard/CalendarView";
import MilestoneBreakdownList from "@/components/dashboard/MilestoneBreakdownList";
import TaskList from "@/components/dashboard/TaskList";
import type { PersonalTask } from "@/lib/tasks/types";
import type { WeekDeadline } from "@/lib/tasks/actions";
import type { Milestone } from "@/lib/supabase/types";

// Holds the one piece of state Calendar and the add-task form need to
// share -- clicking a day above should pre-fill the date below, and that
// only works if something above both server-rendered lists owns it.
export default function TasksPageClient({
  tasks,
  milestones,
  calendarTasks,
  calendarDeadlines,
}: {
  tasks: PersonalTask[];
  milestones: Milestone[];
  calendarTasks: PersonalTask[];
  calendarDeadlines: WeekDeadline[];
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <CalendarView tasks={calendarTasks} deadlines={calendarDeadlines} onDayClick={setSelectedDate} />

      {milestones.length > 0 && <MilestoneBreakdownList milestones={milestones} />}

      <TaskList initialTasks={tasks} milestones={milestones} selectedDate={selectedDate} />
    </div>
  );
}
