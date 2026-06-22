import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireRole } from "@/lib/api";
import { prisma } from "@/lib/db";
import { formatDateUK } from "@/lib/dates";
import { cleanName } from "@/lib/names";
import { canViewGoalScoreRow } from "@/lib/rbac";
import { UserRole } from "@prisma/client";
import { ensureGoalWeekDates } from "@/services/goal-week";
import { recalculateAllPoints } from "@/services/points";

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("member");
    const kind = req.nextUrl.searchParams.get("kind") ?? "actions";
    const month = await prisma.month.findFirst({
      where: { isActive: true, archivedAt: null }
    });
    if (!month) return jsonOk({ month: null, weekDates: [], scores: [] });

    let scores = await prisma.goalScore.findMany({
      where: { monthId: month.id, kind },
      orderBy: [{ staffName: "asc" }, { dayIndex: "asc" }]
    });

    if (scores.length === 0) {
      await recalculateAllPoints();
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

    const rows = [...byStaff.entries()]
      .filter(([staffName]) => {
        const key = cleanName(staffName);
        const targetRole = roleByKey.get(key) ?? "member";
        const isOwn = key === viewerKey;
        return canViewGoalScoreRow(user.role, targetRole, isOwn);
      })
      .map(([staffName, points]) => ({ staffName, points, total: points.reduce((a, b) => a + b, 0) }));

    return jsonOk({ month, weekDates, scores: rows, kind });
  } catch (e) {
    return jsonError(e);
  }
}
