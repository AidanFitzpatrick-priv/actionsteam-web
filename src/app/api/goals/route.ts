import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireRole } from "@/lib/api";
import { prisma } from "@/lib/db";
import { formatDateUK } from "@/lib/dates";

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("member");
    const kind = req.nextUrl.searchParams.get("kind") ?? "actions";
    const month = await prisma.month.findFirst({
      where: { isActive: true, archivedAt: null }
    });
    if (!month) return jsonOk({ month: null, weekDates: [], scores: [] });

    const week = await prisma.goalWeek.findFirst({ where: { monthId: month.id } });
    const weekDates = (week?.weekDates ?? []).map(d => formatDateUK(d));

    const scores = await prisma.goalScore.findMany({
      where: { monthId: month.id, kind },
      orderBy: [{ staffName: "asc" }, { dayIndex: "asc" }]
    });

    const byStaff = new Map<string, number[]>();
    scores.forEach(s => {
      if (!byStaff.has(s.staffName)) byStaff.set(s.staffName, [0, 0, 0, 0, 0, 0, 0]);
      byStaff.get(s.staffName)![s.dayIndex] = s.points;
    });

    const ownOnly = true;
    const rows = [...byStaff.entries()]
      .filter(([name]) => !ownOnly || cleanNameLocal(name) === cleanNameLocal(user.username))
      .map(([staffName, points]) => ({ staffName, points, total: points.reduce((a, b) => a + b, 0) }));

    return jsonOk({ month, weekDates, scores: rows, kind });
  } catch (e) {
    return jsonError(e);
  }
}

function cleanNameLocal(raw: string) {
  let s = raw.trim().toLowerCase();
  if (s.includes("-")) s = s.split("-")[0].trim();
  return s;
}
