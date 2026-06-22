/**
 * Schedule calendar — derives action dates from month + year (matches sheet week blocks).
 * Weeks start on the Monday of the calendar week containing the 1st; partial weeks at
 * the start/end of the month only include days that fall inside the month.
 */
import { toDateOnly } from "@/lib/dates";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
] as const;

export type ScheduleWeekDay = {
  dayIndex: number;
  date: Date;
};

export type ScheduleWeek = {
  weekIndex: number;
  days: ScheduleWeekDay[];
};

export type ParsedMonthLabel = {
  displayName: string;
  monthIndex: number;
  year: number;
};

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return toDateOnly(next);
}

/** Monday of the calendar week containing `d` (Mon–Sun weeks). */
export function getMondayOfWeekContaining(d: Date): Date {
  const date = toDateOnly(d);
  const weekday = date.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  return addDays(date, diff);
}

function monthIndexFromName(name: string): number | null {
  const lower = name.trim().toLowerCase();
  const idx = MONTH_NAMES.findIndex(m => m.toLowerCase() === lower);
  return idx === -1 ? null : idx;
}

/** Parse "June", "June 2026", or "june-2026" into month index + year. */
export function parseMonthLabel(input: string, fallbackYear?: number): ParsedMonthLabel {
  const trimmed = input.trim().replace(/\s+/g, " ");
  const yearMatch = trimmed.match(/^(.+?)[\s-]+(\d{4})$/);
  const year = yearMatch ? parseInt(yearMatch[2], 10) : (fallbackYear ?? new Date().getFullYear());
  const namePart = (yearMatch ? yearMatch[1] : trimmed).trim();

  const monthIndex = monthIndexFromName(namePart);
  if (monthIndex === null) {
    throw new Error(`Unknown month name: "${namePart}"`);
  }

  return {
    displayName: MONTH_NAMES[monthIndex],
    monthIndex,
    year
  };
}

export function resolveMonthYear(month: {
  name: string;
  year?: number | null;
  createdAt: Date;
}): number {
  if (month.year && month.year >= 2000) return month.year;
  try {
    return parseMonthLabel(month.name).year;
  } catch {
    return month.createdAt.getFullYear();
  }
}

/** All schedule weeks for a calendar month (typically 4–5, partial at edges). */
export function buildMonthScheduleCalendar(year: number, monthIndex: number): ScheduleWeek[] {
  const monthStart = toDateOnly(new Date(year, monthIndex, 1, 12, 0, 0));
  const monthEnd = toDateOnly(new Date(year, monthIndex + 1, 0, 12, 0, 0));

  const weeks: ScheduleWeek[] = [];
  let weekMonday = getMondayOfWeekContaining(monthStart);
  let weekIndex = 0;

  while (weekMonday <= addDays(monthEnd, 6)) {
    const days: ScheduleWeekDay[] = [];
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const date = addDays(weekMonday, dayIndex);
      if (date >= monthStart && date <= monthEnd) {
        days.push({ dayIndex, date });
      }
    }

    if (days.length > 0) {
      weeks.push({ weekIndex, days });
      weekIndex++;
    }

    weekMonday = addDays(weekMonday, 7);
  }

  return weeks;
}

export function getActionDateForSlot(
  year: number,
  monthIndex: number,
  weekIndex: number,
  dayIndex: number
): Date | null {
  const calendar = buildMonthScheduleCalendar(year, monthIndex);
  const week = calendar.find(w => w.weekIndex === weekIndex);
  if (!week) return null;
  return week.days.find(d => d.dayIndex === dayIndex)?.date ?? null;
}

export function serializeScheduleCalendar(calendar: ScheduleWeek[]) {
  return calendar.map(week => ({
    weekIndex: week.weekIndex,
    days: week.days.map(day => ({
      dayIndex: day.dayIndex,
      date: day.date.toISOString()
    }))
  }));
}
