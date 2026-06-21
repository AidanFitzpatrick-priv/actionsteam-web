import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireRole } from "@/lib/api";
import { loadStatsRows } from "@/services/tracker";
import { buildAllStatsTables, isRealActionRow } from "@/services/stats";
import { computeMonthlyActionTotals } from "@/services/points";
import { prisma } from "@/lib/db";
import { STAFF_RANK_ORDER } from "@/lib/config";
import { cleanName } from "@/lib/names";

export async function GET(req: NextRequest) {
  try {
    await requireRole("member");
    const all = req.nextUrl.searchParams.get("all") === "1";
    const rows = await loadStatsRows(all);
    const real = rows.filter(isRealActionRow);
    const tables = buildAllStatsTables(real, rows);

    const totals = computeMonthlyActionTotals(
      await prisma.trackerRow.findMany({
        where: { deletedAt: null },
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

    return jsonOk({ tables: { ...tables, monthlyStaffScores } });
  } catch (e) {
    return jsonError(e);
  }
}
