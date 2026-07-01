import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireRole, ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { cleanName } from "@/lib/names";
import { canViewGoalScoreRow, shouldShowOnGoalTracker, sortGoalTrackerRows } from "@/lib/rbac";
import { UserRole } from "@prisma/client";
import { ensureGoalWeekDates, buildWeekColumns } from "@/services/goal-week";
import { recalculateAllPoints, recalculatePointsForMonth } from "@/services/points";

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("member");
    const kindParam = req.nextUrl.searchParams.get("kind") ?? "actions";
    if (kindParam !== "actions") throw new ApiError(404, "Not found");
    const kind = "actions";
    const monthSlug = req.nextUrl.searchParams.get("month");

    let month = monthSlug
      ? await prisma.month.findUnique({ where: { slug: monthSlug } })
      : await prisma.month.findFirst({
          where: { isActive: true, archivedAt: null }
        });

    if (!month || month.archivedAt) return jsonOk({ month: null, weekColumns: [], scores: [] });

    let scores = await prisma.goalScore.findMany({
      where: { monthId: month.id, kind },
      orderBy: [{ staffName: "asc" }, { dayIndex: "asc" }]
    });

    if (scores.length === 0) {
      if (monthSlug) {
        await recalculatePointsForMonth(month.id);
      } else {
        await recalculateAllPoints();
      }
      scores = await prisma.goalScore.findMany({
        where: { monthId: month.id, kind },
        orderBy: [{ staffName: "asc" }, { dayIndex: "asc" }]
      });
    }

    const weekDateObjs = await ensureGoalWeekDates(month);
    const weekColumns = buildWeekColumns(weekDateObjs);

    const [users, staff] = await Promise.all([
      prisma.user.findMany({
        where: { disabledAt: null },
        select: { username: true, role: true, hiddenFromGoalTrackers: true }
      }),
      prisma.staff.findMany({
        where: { deletedAt: null, active: true },
        select: { name: true }
      })
    ]);

    const userMetaByKey = new Map<string, { role: UserRole; hidden: boolean }>();
    for (const u of users) {
      userMetaByKey.set(cleanName(u.username), {
        role: u.role,
        hidden: u.hiddenFromGoalTrackers
      });
    }
    for (const s of staff) {
      const k = cleanName(s.name);
      if (!userMetaByKey.has(k)) userMetaByKey.set(k, { role: "member", hidden: false });
    }

    const viewerKey = cleanName(user.username);

    const byStaff = new Map<string, number[]>();
    scores.forEach(s => {
      if (!byStaff.has(s.staffName)) byStaff.set(s.staffName, [0, 0, 0, 0, 0, 0, 0]);
      byStaff.get(s.staffName)![s.dayIndex] = s.points;
    });

    const rows = sortGoalTrackerRows(
      [...byStaff.entries()]
        .filter(([staffName]) => {
          const key = cleanName(staffName);
          const meta = userMetaByKey.get(key) ?? { role: "member" as UserRole, hidden: false };
          const isOwn = key === viewerKey;
          if (!shouldShowOnGoalTracker(meta.role, meta.hidden)) return false;
          return canViewGoalScoreRow(user.role, meta.role, isOwn);
        })
        .map(([staffName, fullPoints]) => {
          const key = cleanName(staffName);
          const meta = userMetaByKey.get(key) ?? { role: "member" as UserRole, hidden: false };
          const points = weekColumns.map(c => fullPoints[c.dayIndex]);
          const total = points.reduce((a, b) => a + b, 0);
          return {
            staffName,
            role: meta.role,
            points,
            total
          };
        })
    );

    return jsonOk({ month, weekColumns, scores: rows, kind });
  } catch (e) {
    return jsonError(e);
  }
}
