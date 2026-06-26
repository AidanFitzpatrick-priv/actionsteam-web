import { prisma } from "@/lib/db";

export async function getBrTrackerRows(monthId: string) {
  return prisma.brTrackerRow.findMany({
    where: { monthId, deletedAt: null },
    orderBy: { sortOrder: "asc" }
  });
}

export async function patchBrTrackerRow(
  rowId: string,
  data: Partial<{
    actionDate: Date | null;
    typeName: string | null;
    status: string[];
    attended: string[];
    firstPlace: string | null;
    secondPlace: string | null;
    thirdPlace: string | null;
    winnerComped: boolean;
  }>
) {
  return prisma.brTrackerRow.update({ where: { id: rowId }, data });
}

export async function addBrTrackerRow(monthId: string) {
  const maxOrder = await prisma.brTrackerRow.aggregate({
    where: { monthId, deletedAt: null },
    _max: { sortOrder: true }
  });
  return prisma.brTrackerRow.create({
    data: { monthId, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 }
  });
}

export async function softDeleteBrTrackerRow(rowId: string) {
  return prisma.brTrackerRow.update({
    where: { id: rowId },
    data: { deletedAt: new Date() }
  });
}
