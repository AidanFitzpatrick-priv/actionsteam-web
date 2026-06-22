import { prisma } from "@/lib/db";
import { SCHEDULE } from "@/lib/config";
import {
  buildMonthScheduleCalendar,
  parseMonthLabel,
  resolveMonthYear,
  serializeScheduleCalendar,
  type ScheduleWeek
} from "@/lib/schedule-calendar";

export function getCalendarForMonth(month: {
  name: string;
  year?: number | null;
  createdAt: Date;
}): ScheduleWeek[] {
  const year = resolveMonthYear(month);
  const { monthIndex } = parseMonthLabel(month.name, year);
  return buildMonthScheduleCalendar(year, monthIndex);
}

export async function seedScheduleSlotsForMonth(
  monthId: string,
  month: { name: string; year?: number | null; createdAt: Date }
) {
  const calendar = getCalendarForMonth(month);

  for (const week of calendar) {
    for (const day of week.days) {
      for (let rowIndex = 0; rowIndex < SCHEDULE.DATA_ROWS; rowIndex++) {
        await prisma.scheduleSlot.upsert({
          where: {
            monthId_weekIndex_dayIndex_rowIndex: {
              monthId,
              weekIndex: week.weekIndex,
              dayIndex: day.dayIndex,
              rowIndex
            }
          },
          create: {
            monthId,
            weekIndex: week.weekIndex,
            dayIndex: day.dayIndex,
            rowIndex,
            actionDayDate: day.date
          },
          update: { actionDayDate: day.date, deletedAt: null }
        });
      }
    }
  }

  return calendar;
}

export async function applyScheduleCalendarToMonth(monthId: string) {
  const month = await prisma.month.findUnique({ where: { id: monthId } });
  if (!month) throw new Error("Month not found");
  return seedScheduleSlotsForMonth(monthId, month);
}

export function calendarForApi(month: {
  name: string;
  year?: number | null;
  createdAt: Date;
}) {
  const year = resolveMonthYear(month);
  const { monthIndex, displayName } = parseMonthLabel(month.name, year);
  const weeks = buildMonthScheduleCalendar(year, monthIndex);
  return {
    year,
    monthName: displayName,
    weeks: serializeScheduleCalendar(weeks)
  };
}

export function lookupActionDate(
  month: { name: string; year?: number | null; createdAt: Date },
  weekIndex: number,
  dayIndex: number
): Date | null {
  const calendar = getCalendarForMonth(month);
  const week = calendar.find(w => w.weekIndex === weekIndex);
  return week?.days.find(d => d.dayIndex === dayIndex)?.date ?? null;
}
