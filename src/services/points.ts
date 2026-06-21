/**
 * Port of Points.js + GoalTrackers.js — weekly Mon–Sun action & booking points.
 */
import { prisma } from "@/lib/db";
import { parseDate, isSameYMD } from "@/lib/dates";
import { cleanName, normalizeStatus, splitPeopleList } from "@/lib/names";

type ScoreMap = Record<string, number[]>;

function ensureScores(scores: ScoreMap, name: string, days: number) {
  if (!scores[name]) scores[name] = Array(days).fill(0);
}

function addPoints(scores: ScoreMap, nameStr: unknown, dayIdx: number, delta: number) {
  splitPeopleList(nameStr).forEach(name => {
    const k = cleanName(name);
    if (!k || !scores[k]) return;
    scores[k][dayIdx] += delta;
  });
}

/** accumulateActionPointsFromTracker_ */
export function accumulateActionPointsFromTracker(
  rows: Array<{
    actionDate: Date | null;
    status: string[];
    hostedBy: string | null;
    attended: string[];
  }>,
  scores: ScoreMap,
  targetDates: (Date | null)[]
) {
  for (const r of rows) {
    const status = new Set(r.status.map(s => s.toLowerCase()));
    if (!status.size) continue;

    const srcDate = r.actionDate;
    if (!srcDate) continue;
    const dayIdx = targetDates.findIndex(t => t && isSameYMD(srcDate, t));
    if (dayIdx === -1) continue;

    if (status.has("actions didn't attend")) {
      addPoints(scores, r.hostedBy, dayIdx, -1);
      continue;
    }
    if (
      status.has("completed") ||
      status.has("org 1 didn't attend") ||
      status.has("org 2 didn't attend")
    ) {
      addPoints(scores, r.hostedBy, dayIdx, 2);
      addPoints(scores, r.attended.join(", "), dayIdx, 1);
    }
  }
}

/** calculateBookingPoints schedule half */
export function accumulateBookingPointsFromSlots(
  slots: Array<{ dateBooked: Date | null; bookedBy: string | null }>,
  scores: ScoreMap,
  targetDates: (Date | null)[]
) {
  for (const slot of slots) {
    if (!slot.bookedBy || !slot.dateBooked) continue;
    const idx = targetDates.findIndex(t => t && isSameYMD(slot.dateBooked, t));
    if (idx !== -1) addPoints(scores, slot.bookedBy, idx, 1);
  }
}

export async function recalculateAllPoints() {
  const staff = await prisma.staff.findMany({ where: { deletedAt: null, active: true } });
  const staffKeys = staff.map(s => cleanName(s.name)).filter(Boolean);

  const actionScores: ScoreMap = {};
  const bookingScores: ScoreMap = {};
  staffKeys.forEach(k => {
    actionScores[k] = [0, 0, 0, 0, 0, 0, 0];
    bookingScores[k] = [0, 0, 0, 0, 0, 0, 0];
  });

  const activeMonth = await prisma.month.findFirst({
    where: { isActive: true, archivedAt: null }
  });

  const weekDates = activeMonth
    ? await getWeekDatesForMonth(activeMonth.id)
    : Array(7).fill(null);

  const trackerRows = await prisma.trackerRow.findMany({
    where: { deletedAt: null },
    select: {
      actionDate: true,
      status: true,
      hostedBy: true,
      attended: true
    }
  });

  accumulateActionPointsFromTracker(trackerRows, actionScores, weekDates);

  const scheduleSlots = await prisma.scheduleSlot.findMany({
    where: { deletedAt: null },
    select: { dateBooked: true, bookedBy: true }
  });
  accumulateBookingPointsFromSlots(scheduleSlots, bookingScores, weekDates);

  if (activeMonth) {
    await persistGoalScores(activeMonth.id, "actions", actionScores, staff);
    await persistGoalScores(activeMonth.id, "bookings", bookingScores, staff);
  }

  return { actionScores, bookingScores, weekDates };
}

async function getWeekDatesForMonth(monthId: string): Promise<(Date | null)[]> {
  const week = await prisma.goalWeek.findFirst({ where: { monthId } });
  if (week?.weekDates?.length === 7) {
    return week.weekDates.map(d => parseDate(d));
  }
  return Array(7).fill(null);
}

async function persistGoalScores(
  monthId: string,
  kind: string,
  scores: ScoreMap,
  staff: Array<{ name: string }>
) {
  for (const s of staff) {
    const k = cleanName(s.name);
    const points = scores[k] ?? [0, 0, 0, 0, 0, 0, 0];
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      await prisma.goalScore.upsert({
        where: {
          staffName_monthId_kind_dayIndex: {
            staffName: s.name,
            monthId,
            kind,
            dayIndex
          }
        },
        create: { staffName: s.name, monthId, kind, dayIndex, points: points[dayIndex] },
        update: { points: points[dayIndex] }
      });
    }
  }
}

export function computeMonthlyActionTotals(
  rows: Array<{ status: string[]; hostedBy: string | null; attended: string[] }>
) {
  const totals: Record<string, number> = {};
  const apply = (nameStr: unknown, delta: number) => {
    splitPeopleList(nameStr).forEach(name => {
      const k = cleanName(name);
      if (!k) return;
      totals[k] = (totals[k] ?? 0) + delta;
    });
  };

  for (const r of rows) {
    const status = normalizeStatus(r.status.join(", "));
    if (!status.size) continue;
    if (status.has("actions didn't attend")) {
      apply(r.hostedBy, -1);
      continue;
    }
    if (
      status.has("completed") ||
      status.has("org 1 didn't attend") ||
      status.has("org 2 didn't attend")
    ) {
      apply(r.hostedBy, 2);
      apply(r.attended.join(", "), 1);
    }
  }

  return totals;
}

/** TrackerFormat.js / MenuAndTriggers — N/A winner clears headcounts. */
export function applyWinnerSideEffects(winner: string | null | undefined): {
  org1Attended: string | null;
  org2Attended: string | null;
  winnerColor: string;
} {
  const w = String(winner ?? "").trim().toLowerCase();
  if (w === "n/a" || w === "na") {
    return { org1Attended: "N/A", org2Attended: "N/A", winnerColor: "#d9d9d9" };
  }
  if (w === "pd") return { org1Attended: null, org2Attended: null, winnerColor: "#cfe2f3" };
  if (w) return { org1Attended: null, org2Attended: null, winnerColor: "#f4cccc" };
  return { org1Attended: null, org2Attended: null, winnerColor: "#ffffff" };
}
