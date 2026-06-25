import { prisma } from "@/lib/db";
import { applyWinnerSideEffects } from "@/services/points";
import type { StatsRow } from "@/services/stats";

export async function getTrackerRows(monthId: string) {
  return prisma.trackerRow.findMany({
    where: { monthId, deletedAt: null },
    orderBy: { sortOrder: "asc" },
    include: { scheduleSlot: { select: { timeText: true } } }
  });
}

export async function patchTrackerRow(
  rowId: string,
  data: Partial<{
    actionDate: Date | null;
    typeName: string | null;
    status: string[];
    org1Name: string | null;
    org2Name: string | null;
    hostedBy: string | null;
    attended: string[];
    idsText: string | null;
    winnerComped: boolean;
    actionWinner: string | null;
    org1Attended: string | null;
    org2Attended: string | null;
  }>
) {
  let patch = { ...data };

  if (data.actionWinner !== undefined) {
    const fx = applyWinnerSideEffects(data.actionWinner);
    patch = {
      ...patch,
      org1Attended: fx.org1Attended ?? patch.org1Attended,
      org2Attended: fx.org2Attended ?? patch.org2Attended
    };
  }

  return prisma.trackerRow.update({ where: { id: rowId }, data: patch });
}

export async function addTrackerRow(monthId: string) {
  const maxOrder = await prisma.trackerRow.aggregate({
    where: { monthId, deletedAt: null },
    _max: { sortOrder: true }
  });
  return prisma.trackerRow.create({
    data: { monthId, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 }
  });
}

export async function softDeleteTrackerRow(rowId: string) {
  return prisma.trackerRow.update({
    where: { id: rowId },
    data: { deletedAt: new Date(), scheduleSlotId: null }
  });
}

export async function loadStatsRows(useAllMonths = false): Promise<StatsRow[]> {
  const rows = await prisma.trackerRow.findMany({
    where: { deletedAt: null, ...(useAllMonths ? {} : {}) },
    select: {
      actionDate: true,
      typeName: true,
      org1Name: true,
      org2Name: true,
      attended: true,
      actionWinner: true,
      org1Attended: true,
      org2Attended: true,
      status: true
    }
  });

  return rows.map(r => ({
    type: r.typeName ?? "",
    gang: r.org1Name ?? "",
    org2: r.org2Name ?? "",
    attendedList: r.attended.join(", "),
    winner: r.actionWinner ?? "",
    pdMembers: r.org2Attended,
    gangMembers: r.org1Attended,
    status: r.status.join(", "),
    date: r.actionDate
  }));
}

export async function loadStatsForMonth(monthId: string): Promise<StatsRow[]> {
  const rows = await prisma.trackerRow.findMany({
    where: { monthId, deletedAt: null },
    select: {
      actionDate: true,
      typeName: true,
      org1Name: true,
      org2Name: true,
      attended: true,
      actionWinner: true,
      org1Attended: true,
      org2Attended: true,
      status: true
    }
  });

  return rows.map(r => ({
    type: r.typeName ?? "",
    gang: r.org1Name ?? "",
    org2: r.org2Name ?? "",
    attendedList: r.attended.join(", "),
    winner: r.actionWinner ?? "",
    pdMembers: r.org2Attended,
    gangMembers: r.org1Attended,
    status: r.status.join(", "),
    date: r.actionDate
  }));
}
