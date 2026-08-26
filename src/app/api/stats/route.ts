import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireRole } from "@/lib/api";
import { loadStatsForMonth } from "@/services/tracker";
import {
  buildAllStatsTables,
  buildOverview,
  isRealActionRow,
  monthMatchesKey,
  previousMonthKey
} from "@/services/stats";
import { computeMonthlyActionTotals } from "@/services/points";
import { prisma } from "@/lib/db";
import { STAFF_RANK_ORDER } from "@/lib/config";
import { cleanName } from "@/lib/names";
import { hasMinRole, shouldShowOnGoalTracker } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("member");
    const monthSlug = req.nextUrl.searchParams.get("month");
    const canViewTeam = hasMinRole(user.role, "aux");

    const month = monthSlug
      ? await prisma.month.findUnique({ where: { slug: monthSlug } })
      : await prisma.month.findFirst({
          where: { isActive: true, archivedAt: null }
        });

    if (!month || month.archivedAt) {
      return jsonOk({
        month: null,
        canViewTeam,
        overview: null,
        tables: {}
      });
    }

    const rows = await loadStatsForMonth(month.id);
    const real = rows.filter(isRealActionRow);
    const tables = buildAllStatsTables(real, rows);

    const trackerRows = await prisma.trackerRow.findMany({
      where: { monthId: month.id, deletedAt: null },
      select: { status: true, hostedBy: true, attended: true }
    });
    const totals = computeMonthlyActionTotals(trackerRows);

    const allMonths = await prisma.month.findMany({
      where: { archivedAt: null },
      select: { id: true, name: true, year: true, createdAt: true }
    });
    const prevKey = previousMonthKey(month);
    const prevMonth = prevKey
      ? allMonths.find(m => m.id !== month.id && monthMatchesKey(m, prevKey))
      : undefined;

    let lastMonthTotal: number | null = null;
    if (prevMonth) {
      const prevRows = await loadStatsForMonth(prevMonth.id);
      lastMonthTotal = prevRows.filter(isRealActionRow).length;
    }

    const overview = buildOverview(real, { lastMonthTotal });

    const [staff, users] = await Promise.all([
      prisma.staff.findMany({
        where: { deletedAt: null, active: true },
        orderBy: { name: "asc" }
      }),
      prisma.user.findMany({
        where: { disabledAt: null },
        select: { username: true, role: true, hiddenFromGoalTrackers: true }
      })
    ]);

    const monthlyStaffScores = canViewTeam
      ? {
          headers: ["Name", "Score"],
          rows: (() => {
            const seen = new Set<string>();
            const rows: (string | number)[][] = [];
            const push = (name: string) => {
              const key = cleanName(name);
              if (!key || seen.has(key)) return;
              seen.add(key);
              rows.push([name, totals[key] ?? 0]);
            };
            for (const rank of STAFF_RANK_ORDER) {
              for (const s of staff) {
                if ((s.rank ?? "Member") === rank) push(s.name);
              }
            }
            for (const s of staff) push(s.name);
            for (const u of users) {
              if (!shouldShowOnGoalTracker(u.role, u.hiddenFromGoalTrackers)) continue;
              push(u.username);
            }
            return rows;
          })()
        }
      : { headers: ["Name", "Score"], rows: [] as (string | number)[][] };

    return jsonOk({
      month: {
        name: month.name,
        slug: month.slug,
        year: month.year,
        isActive: month.isActive
      },
      canViewTeam,
      overview,
      tables: { ...tables, monthlyStaffScores }
    });
  } catch (e) {
    return jsonError(e);
  }
}
