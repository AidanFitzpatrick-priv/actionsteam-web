import { prisma } from "@/lib/db";
import { publishAdminChange, publishLiveEvent } from "@/services/live-sync";
import { recalculatePointsForMonth } from "@/services/points";

async function nonArchivedMonthIds(): Promise<string[]> {
  const months = await prisma.month.findMany({
    where: { archivedAt: null },
    select: { id: true }
  });
  return months.map(m => m.id);
}

export async function recalculateNonArchivedMonths() {
  for (const monthId of await nonArchivedMonthIds()) {
    await recalculatePointsForMonth(monthId);
  }
}

export async function publishUserGoalSync(actorId: string) {
  await publishLiveEvent({ type: "goals.updated", scope: "global", actorId });
  await publishAdminChange(actorId, "users:goals-sync");
}

/** Rename display name in schedule/tracker source data (call before user row update). */
export async function renameUserDisplayNameInSources(oldName: string, newName: string) {
  const oldTrim = oldName.trim();
  const newTrim = newName.trim();
  if (!oldTrim || oldTrim === newTrim) return;

  await prisma.scheduleSlot.updateMany({
    where: { bookedBy: oldTrim, deletedAt: null },
    data: { bookedBy: newTrim }
  });

  await prisma.trackerRow.updateMany({
    where: { hostedBy: oldTrim, deletedAt: null },
    data: { hostedBy: newTrim }
  });

  const attendedRows = await prisma.trackerRow.findMany({
    where: { deletedAt: null, attended: { has: oldTrim } },
    select: { id: true, attended: true }
  });
  for (const row of attendedRows) {
    await prisma.trackerRow.update({
      where: { id: row.id },
      data: { attended: row.attended.map(name => (name === oldTrim ? newTrim : name)) }
    });
  }
}

/** Remove goal rows for deleted user; leave schedule/tracker text for audit. */
export async function removeUserFromGoalData(username: string) {
  const name = username.trim();
  if (!name) return;

  await prisma.goalScore.deleteMany({ where: { staffName: name } });
  // Schedule/tracker historical names kept intentionally (audit trail).
}
