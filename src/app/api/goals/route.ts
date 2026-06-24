import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireRole } from "@/lib/api";
import { prisma } from "@/lib/db";
import { formatDateUK } from "@/lib/dates";
import { cleanName } from "@/lib/names";
import { canViewGoalScoreRow, shouldShowOnGoalTracker, sortGoalTrackerRows } from "@/lib/rbac";
import { UserRole } from "@prisma/client";
import { ensureGoalWeekDates } from "@/services/goal-week";
import { recalculateAllPoints, recalculatePointsForMonth } from "@/services/points";

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("member");
    const kind = req.nextUrl.searchParams.get("kind") ?? "actions";
    const monthSlug = req.nextUrl.searchParams.get("month");

    let month = monthSlug
      ? await prisma.month.findUnique({ where: { slug: monthSlug } })
      : await prisma.month.findFirst({
          where: { isActive: true, archivedAt: null }
        });

    if (!month || month.archivedAt) return jsonOk({ month: null, weekDates: [], scores: [] });

    let scores = await prisma.goalScore.findMany({
      where: { monthId: month.id, kind },
      orderBy: [{ staffName: "asc" }, { dayIndex: "asc" }]
    });

    if (scores.length === 0) {
      if (monthSlug || kind === "bookings") {
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
    const weekDates = weekDateObjs.map(d => (d ? formatDateUK(d) : ""));

    const [users, staff] = await Promise.all([
      prisma.user.findMany({
        where: { disabledAt: null },
        select: { username: true, role: true }
      }),
      prisma.staff.findMany({
        where: { deletedAt: null, active: true },
        select: { name: true }
      })
    ]);

    const roleByKey = new Map<string, UserRole>();
    for (const u of users) {
      roleByKey.set(cleanName(u.username), u.role);
    }
    for (const s of staff) {
      const k = cleanName(s.name);
      if (!roleByKey.has(k)) roleByKey.set(k, "member");
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
          const targetRole = roleByKey.get(key) ?? "member";
          const isOwn = key === viewerKey;
          if (!shouldShowOnGoalTracker(targetRole)) return false;
          return canViewGoalScoreRow(user.role, targetRole, isOwn);
        })
        .map(([staffName, points]) => {
          const key = cleanName(staffName);
          const role = roleByKey.get(key) ?? "member";
          return {
            staffName,
            role,
            points,
            total: points.reduce((a, b) => a + b, 0)
          };
        })
    );

    return jsonOk({ month, weekDates, scores: rows, kind });
  } catch (e) {
    return jsonError(e);
  }
}
