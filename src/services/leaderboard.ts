import { prisma } from "@/lib/db";
import { formatDateUK } from "@/lib/dates";
import {
  buildRankedParticipants,
  rankLeaderboard,
  rowsInWeek,
  type LeaderboardRow
} from "@/lib/leaderboard";
import { WEEKLY_ACTION_GOAL } from "@/lib/goals";
import { computeMonthlyActionTotals } from "@/services/points";
import { ensureGoalWeekDates } from "@/services/goal-week";

export type LeaderboardPeriod = {
  label: string;
  rows: LeaderboardRow[];
};

export async function loadLeaderboard(): Promise<{
  week: LeaderboardPeriod;
  month: LeaderboardPeriod;
  allTime: LeaderboardPeriod;
  goal: number;
}> {
  const activeMonth = await prisma.month.findFirst({
    where: { isActive: true, archivedAt: null }
  });

  const [users, staff, trackerRows, weekDates] = await Promise.all([
    prisma.user.findMany({
      where: { disabledAt: null },
      select: { username: true, role: true, hiddenFromGoalTrackers: true }
    }),
    prisma.staff.findMany({
      where: { deletedAt: null, active: true },
      select: { name: true }
    }),
    prisma.trackerRow.findMany({
      where: { deletedAt: null },
      select: { actionDate: true, status: true, hostedBy: true, attended: true, monthId: true }
    }),
    activeMonth ? ensureGoalWeekDates(activeMonth) : Promise.resolve(Array(7).fill(null) as (Date | null)[])
  ]);

  const participants = buildRankedParticipants(users, staff);
  const monthRows = activeMonth
    ? trackerRows.filter(r => r.monthId === activeMonth.id)
    : [];
  const weekRows = rowsInWeek(monthRows, weekDates);

  const dated = weekDates.filter((d): d is Date => d !== null);
  const weekLabel =
    dated.length === 0
      ? "This week"
      : dated.length === 1
        ? formatDateUK(dated[0])
        : `${formatDateUK(dated[0])} – ${formatDateUK(dated[dated.length - 1])}`;

  const monthLabel = activeMonth
    ? `${activeMonth.name}${activeMonth.year ? ` ${activeMonth.year}` : ""}`
    : "This month";

  return {
    week: { label: weekLabel, rows: rankLeaderboard(computeMonthlyActionTotals(weekRows), participants) },
    month: { label: monthLabel, rows: rankLeaderboard(computeMonthlyActionTotals(monthRows), participants) },
    allTime: {
      label: "All time",
      rows: rankLeaderboard(computeMonthlyActionTotals(trackerRows), participants)
    },
    goal: WEEKLY_ACTION_GOAL
  };
}
