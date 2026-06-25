/**
 * Port of Points.js + GoalTrackers.js — weekly Mon–Sun action points.
 */
import { prisma } from "@/lib/db";
import { isSameYMD } from "@/lib/dates";
import { cleanName, normalizeStatus, splitPeopleList } from "@/lib/names";
import { shouldShowOnGoalTracker } from "@/lib/rbac";
import { UserRole } from "@prisma/client";
import { ensureGoalWeekDates } from "@/services/goal-week";

type ScoreMap = Record<string, number[]>;

function initScores(keys: string[]): ScoreMap {
  const scores: ScoreMap = {};
  keys.forEach(k => {
    scores[k] = [0, 0, 0, 0, 0, 0, 0];
  });
  return scores;
}

function addPoints(scores: ScoreMap, nameStr: unknown, dayIdx: number, delta: number) {
  splitPeopleList(nameStr).forEach(name => {
    const k = cleanName(name);
    if (!k || !scores[k]) return;
    scores[k][dayIdx] += delta;
  });
}

/** Staff + account users — spreadsheet goal sheet rows include everyone who can score. */
async function buildScoreParticipants(): Promise<Map<string, string>> {
  const [staff, users] = await Promise.all([
    prisma.staff.findMany({ where: { deletedAt: null, active: true } }),
    prisma.user.findMany({
      where: { disabledAt: null },
      select: { username: true, role: true, hiddenFromGoalTrackers: true }
    })
  ]);

  const displayByKey = new Map<string, string>();
  for (const s of staff) {
    const k = cleanName(s.name);
    if (k) displayByKey.set(k, s.name);
  }
  for (const u of users) {
    if (!shouldShowOnGoalTracker(u.role as UserRole, u.hiddenFromGoalTrackers)) continue;
    const k = cleanName(u.username);
    if (k && !displayByKey.has(k)) displayByKey.set(k, u.username);
  }
  return displayByKey;
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
      addPoints(scores, r.attended, dayIdx, 1);
    }
  }
}

export async function recalculatePointsForMonth(monthId: string) {
  const month = await prisma.month.findUnique({ where: { id: monthId } });
  if (!month || month.archivedAt) {
    return { actionScores: {}, weekDates: Array(7).fill(null) };
  }

  const displayByKey = await buildScoreParticipants();
  const keys = [...displayByKey.keys()];
  const actionScores = initScores(keys);

  const weekDates = await ensureGoalWeekDates(month);

  const trackerRows = await prisma.trackerRow.findMany({
    where: { monthId: month.id, deletedAt: null },
    select: {
      actionDate: true,
      status: true,
      hostedBy: true,
      attended: true
    }
  });

  accumulateActionPointsFromTracker(trackerRows, actionScores, weekDates);

  await persistGoalScores(month.id, "actions", actionScores, displayByKey);
  await pruneOrphanedGoalScores(month.id, "actions", displayByKey);
  await prisma.goalScore.deleteMany({ where: { monthId: month.id, kind: "bookings" } });

  return { actionScores, weekDates };
}

export async function recalculateAllPoints() {
  const activeMonth = await prisma.month.findFirst({
    where: { isActive: true, archivedAt: null }
  });
  if (!activeMonth) {
    return { actionScores: {}, weekDates: Array(7).fill(null) };
  }

  return recalculatePointsForMonth(activeMonth.id);
}

async function persistGoalScores(
  monthId: string,
  kind: string,
  scores: ScoreMap,
  displayByKey: Map<string, string>
) {
  for (const [k, displayName] of displayByKey) {
    const points = scores[k] ?? [0, 0, 0, 0, 0, 0, 0];
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      await prisma.goalScore.upsert({
        where: {
          staffName_monthId_kind_dayIndex: {
            staffName: displayName,
            monthId,
            kind,
            dayIndex
          }
        },
        create: { staffName: displayName, monthId, kind, dayIndex, points: points[dayIndex] },
        update: { points: points[dayIndex] }
      });
    }
  }
}

/** Drop goal rows for names no longer in the participant list (renamed/deleted users). */
export async function pruneOrphanedGoalScores(
  monthId: string,
  kind: string,
  displayByKey: Map<string, string>
) {
  const allowed = new Set(displayByKey.values());
  const rows = await prisma.goalScore.findMany({
    where: { monthId, kind },
    select: { id: true, staffName: true }
  });
  const orphanIds = rows.filter(r => !allowed.has(r.staffName)).map(r => r.id);
  if (orphanIds.length === 0) return;
  await prisma.goalScore.deleteMany({ where: { id: { in: orphanIds } } });
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
