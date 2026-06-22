/**
 * Goal tracker week dates (Action/Booking Goal Tracker row 1 in the sheet).
 */
import { prisma } from "@/lib/db";
import { isSameYMD, toDateOnly } from "@/lib/dates";
import { getCalendarForMonth } from "@/services/schedule-calendar";
import type { ScheduleWeek } from "@/lib/schedule-calendar";

function weekToDateArray(week: ScheduleWeek): (Date | null)[] {
  const dates: (Date | null)[] = Array(7).fill(null);
  for (const day of week.days) {
    dates[day.dayIndex] = day.date;
  }
  return dates;
}

async function findWeekFromLatestTracker(monthId: string, calendar: ScheduleWeek[]) {
  const latest = await prisma.trackerRow.findFirst({
    where: { monthId, deletedAt: null, actionDate: { not: null } },
    orderBy: { actionDate: "desc" },
    select: { actionDate: true }
  });
  if (!latest?.actionDate) return null;
  return (
    calendar.find(w => w.days.some(d => isSameYMD(d.date, latest.actionDate!))) ?? null
  );
}

function findWeekContainingToday(calendar: ScheduleWeek[]) {
  const today = toDateOnly(new Date());
  return calendar.find(w => w.days.some(d => isSameYMD(d.date, today))) ?? null;
}

/** Resolve Mon–Sun dates for the active scoring week. */
export async function ensureGoalWeekDates(month: {
  id: string;
  name: string;
  year?: number | null;
  createdAt: Date;
}): Promise<(Date | null)[]> {
  const calendar = getCalendarForMonth(month);
  if (!calendar.length) return Array(7).fill(null);

  const week =
    findWeekContainingToday(calendar) ??
    (await findWeekFromLatestTracker(month.id, calendar)) ??
    calendar[0];

  const weekDates = weekToDateArray(week);

  const storedDates = weekDates.filter((d): d is Date => d !== null);
  const existing = await prisma.goalWeek.findFirst({ where: { monthId: month.id } });
  if (existing) {
    await prisma.goalWeek.update({
      where: { id: existing.id },
      data: { weekDates: storedDates }
    });
  } else {
    await prisma.goalWeek.create({
      data: { monthId: month.id, weekDates: storedDates }
    });
  }

  return weekDates;
}

export async function getGoalWeekDates(monthId: string): Promise<(Date | null)[]> {
  const month = await prisma.month.findUnique({ where: { id: monthId } });
  if (!month) return Array(7).fill(null);
  return ensureGoalWeekDates(month);
}
