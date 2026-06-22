/**
 * Port of ScheduleTrackerSync.js — schedule slot ↔ tracker row sync.
 * Uses scheduleSlotId FK instead of document Properties links.
 */
import { prisma } from "@/lib/db";
import { parseTimeMinutes, toDateOnly } from "@/lib/dates";
import { lookupActionDate } from "@/services/schedule-calendar";

type SlotUpdate = {
  typeName?: string | null;
  orgName?: string | null;
  timeText?: string | null;
  actionDayDate?: Date | null;
  dateBooked?: Date | null;
  bookedBy?: string | null;
};

function isTrackerRowFilledOut(row: {
  status: string[];
  hostedBy: string | null;
  attended: string[];
  org2Name: string | null;
  actionWinner: string | null;
}): boolean {
  if (row.status.length > 0) return true;
  if (row.hostedBy?.trim()) return true;
  if (row.attended.length > 0) return true;
  if (row.org2Name?.trim()) return true;
  if (row.actionWinner?.trim()) return true;
  return false;
}

async function findAppendTrackerRow(monthId: string) {
  const empty = await prisma.trackerRow.findFirst({
    where: {
      monthId,
      deletedAt: null,
      actionDate: null,
      typeName: null,
      org1Name: null,
      status: { isEmpty: true },
      hostedBy: null
    },
    orderBy: { sortOrder: "asc" }
  });
  if (empty) return empty;

  const maxOrder = await prisma.trackerRow.aggregate({
    where: { monthId, deletedAt: null },
    _max: { sortOrder: true }
  });

  return prisma.trackerRow.create({
    data: { monthId, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 }
  });
}

async function reorderTrackerRows(monthId: string) {
  const rows = await prisma.trackerRow.findMany({
    where: { monthId, deletedAt: null },
    include: { scheduleSlot: { select: { timeText: true } } }
  });

  const withData = rows.filter(r =>
    r.actionDate || r.typeName || r.org1Name || r.status.length || r.hostedBy
  );
  const empty = rows.filter(r => !withData.includes(r));

  withData.sort((a, b) => {
    const ta = a.actionDate?.getTime() ?? 0;
    const tb = b.actionDate?.getTime() ?? 0;
    if (ta !== tb) return ta - tb;
    const tma = parseTimeMinutes(a.scheduleSlot?.timeText);
    const tmb = parseTimeMinutes(b.scheduleSlot?.timeText);
    return tma - tmb;
  });

  const sorted = [...withData, ...empty];
  await Promise.all(
    sorted.map((row, idx) =>
      prisma.trackerRow.update({ where: { id: row.id }, data: { sortOrder: idx } })
    )
  );
}

/** syncOneScheduleSlot_ */
export async function syncScheduleSlotToTracker(slotId: string) {
  const slot = await prisma.scheduleSlot.findUnique({
    where: { id: slotId },
    include: { month: true, trackerRows: { where: { deletedAt: null } } }
  });
  if (!slot || slot.deletedAt) return;

  const type = slot.typeName?.trim() ?? "";
  const org = slot.orgName?.trim() ?? "";
  const linked = slot.trackerRows[0] ?? null;

  if (type && org) {
    const actionDate =
      (slot.actionDayDate ? toDateOnly(slot.actionDayDate) : null) ??
      lookupActionDate(slot.month, slot.weekIndex, slot.dayIndex);
    if (!actionDate) return;

    if (linked) {
      if (isTrackerRowFilledOut(linked)) return;
      await prisma.trackerRow.update({
        where: { id: linked.id },
        data: { actionDate, typeName: type, org1Name: org }
      });
    } else {
      const duplicate = await prisma.trackerRow.findFirst({
        where: {
          monthId: slot.monthId,
          deletedAt: null,
          actionDate,
          typeName: type,
          org1Name: org,
          NOT: { status: { isEmpty: true } }
        }
      });
      if (duplicate) return;

      const target = await findAppendTrackerRow(slot.monthId);
      await prisma.trackerRow.update({
        where: { id: target.id },
        data: {
          scheduleSlotId: slot.id,
          actionDate,
          typeName: type,
          org1Name: org
        }
      });
    }
    await reorderTrackerRows(slot.monthId);
    return;
  }

  if (!linked) return;
  if (isTrackerRowFilledOut(linked)) {
    await prisma.trackerRow.update({
      where: { id: linked.id },
      data: { scheduleSlotId: null }
    });
    return;
  }

  await prisma.trackerRow.update({
    where: { id: linked.id },
    data: { deletedAt: new Date(), scheduleSlotId: null }
  });
  await reorderTrackerRows(slot.monthId);
}

export async function applyScheduleSlotUpdate(slotId: string, update: SlotUpdate) {
  const existing = await prisma.scheduleSlot.findUnique({ where: { id: slotId } });
  if (!existing) throw new Error("Schedule slot not found");

  const data: SlotUpdate = { ...update };

  if ("bookedBy" in update) {
    const newBy = update.bookedBy?.trim() ?? "";
    if (!newBy) {
      data.dateBooked = null;
    } else if (!existing.dateBooked) {
      data.dateBooked = toDateOnly(new Date());
    }
  }

  const slot = await prisma.scheduleSlot.update({
    where: { id: slotId },
    data
  });
  return slot;
}

/** Full import — sync all booked slots for a month (MenuAndTriggers import). */
export async function importScheduleToTracker(monthId: string) {
  const slots = await prisma.scheduleSlot.findMany({
    where: { monthId, deletedAt: null, typeName: { not: null }, orgName: { not: null } }
  });
  for (const slot of slots) {
    await syncScheduleSlotToTracker(slot.id);
  }
}
