import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireRole } from "@/lib/api";
import { loadStatsForMonth } from "@/services/tracker";
import { buildAllStatsTables, isRealActionRow } from "@/services/stats";
import { computeMonthlyActionTotals } from "@/services/points";
import { prisma } from "@/lib/db";
import { STAFF_RANK_ORDER } from "@/lib/config";
import { cleanName } from "@/lib/names";

export async function GET(req: NextRequest) {
  try {
    await requireRole("member");
    const monthSlug = req.nextUrl.searchParams.get("month");

    const month = monthSlug
      ? await prisma.month.findUnique({ where: { slug: monthSlug } })
      : await prisma.month.findFirst({
          where: { isActive: true, archivedAt: null }
        });

    if (!month || month.archivedAt) {
      return jsonOk({ month: null, tables: {} });
    }

    const rows = await loadStatsForMonth(month.id);
    const real = rows.filter(isRealActionRow);
    const tables = buildAllStatsTables(real, rows);

    const totals = computeMonthlyActionTotals(
      await prisma.trackerRow.findMany({
        where: { monthId: month.id, deletedAt: null },
        select: { status: true, hostedBy: true, attended: true }
      })
    );

    const staff = await prisma.staff.findMany({
      where: { deletedAt: null, active: true },
      orderBy: { name: "asc" }
    });

    const byRank: Record<string, string[]> = {};
    staff.forEach(s => {
      const rank = s.rank ?? "Member";
      if (!byRank[rank]) byRank[rank] = [];
      byRank[rank].push(s.name);
    });

    const monthlyStaffScores = {
      headers: ["Name", "Score"],
      rows: STAFF_RANK_ORDER.flatMap(rank =>
        (byRank[rank] ?? []).map(name => [name, totals[cleanName(name)] ?? 0])
      )
    };

    return jsonOk({
      month: {
        name: month.name,
        slug: month.slug,
        year: month.year,
        isActive: month.isActive
      },
      tables: { ...tables, monthlyStaffScores }
    });
  } catch (e) {
    return jsonError(e);
  }
}
