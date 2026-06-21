import { prisma } from "@/lib/db";
import { applyScheduleSlotUpdate } from "@/services/schedule-sync";

export async function getScheduleSlots(monthId: string) {
  return prisma.scheduleSlot.findMany({
    where: { monthId, deletedAt: null },
    orderBy: [{ weekIndex: "asc" }, { dayIndex: "asc" }, { rowIndex: "asc" }]
  });
}

export async function patchScheduleSlot(
  slotId: string,
  data: Partial<{
    timeText: string | null;
    typeName: string | null;
    dateBooked: Date | null;
    bookedBy: string | null;
    orgName: string | null;
  }>
) {
  return applyScheduleSlotUpdate(slotId, data);
}

export async function getTypeColorMap() {
  const types = await prisma.actionType.findMany({ where: { deletedAt: null } });
  return Object.fromEntries(types.map(t => [t.name, t.colourHex]));
}

/** SchedulePaint.js — colour from action type name. */
export function colorForType(typeName: string | null, colorMap: Record<string, string>): string {
  if (!typeName?.trim()) return "#ffffff";
  return colorMap[typeName.trim()] ?? "#ffffff";
}
