import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { writeFile, mkdir, readFile, unlink } from "fs/promises";
import path from "path";

const BACKUP_DIR = path.join(process.cwd(), "backups");

export const BACKUP_MAX_COUNT = 4;
export const BACKUP_INTERVAL_MS = 12 * 60 * 60 * 1000;

export async function listBackups() {
  const rows = await prisma.backup.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return rows.map(r => ({
    id: r.id,
    createdAt: r.createdAt,
    sizeBytes: r.sizeBytes?.toString() ?? null,
    storageKey: r.storageKey,
    status: r.status,
    createdBy: r.createdBy,
    kind: r.kind
  }));
}

export async function pruneBackups(maxCount = BACKUP_MAX_COUNT) {
  const rows = await prisma.backup.findMany({ orderBy: { createdAt: "desc" } });
  const excess = rows.slice(maxCount);
  for (const row of excess) {
    const filePath = path.join(BACKUP_DIR, row.storageKey);
    try {
      await unlink(filePath);
    } catch {
      // File may already be missing (e.g. ephemeral Railway disk after redeploy)
    }
    await prisma.backup.delete({ where: { id: row.id } });
  }
}

export async function runBackup(params?: { createdBy?: string; kind?: string }) {
  await mkdir(BACKUP_DIR, { recursive: true });
  const key = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

  const snapshot = {
    at: new Date().toISOString(),
    users: await prisma.user.findMany({ select: { id: true, email: true, username: true, role: true } }),
    months: await prisma.month.findMany(),
    staff: await prisma.staff.findMany({ where: { deletedAt: null } }),
    actionTypes: await prisma.actionType.findMany({ where: { deletedAt: null } }),
    gangs: await prisma.gang.findMany({ where: { deletedAt: null } }),
    scheduleSlots: await prisma.scheduleSlot.findMany({ where: { deletedAt: null } }),
    trackerRows: await prisma.trackerRow.findMany({ where: { deletedAt: null } }),
    brTrackerRows: await prisma.brTrackerRow.findMany({ where: { deletedAt: null } }),
    goalScores: await prisma.goalScore.findMany()
  };

  const filePath = path.join(BACKUP_DIR, key);
  const content = JSON.stringify(snapshot, null, 2);
  await writeFile(filePath, content);

  const record = await prisma.backup.create({
    data: {
      storageKey: key,
      sizeBytes: BigInt(Buffer.byteLength(content)),
      status: "completed",
      createdBy: params?.createdBy ?? "system",
      kind: params?.kind ?? "manual"
    }
  });

  await pruneBackups(BACKUP_MAX_COUNT);

  return record;
}

/** Run scheduled backup if none in the last 12 hours. */
export async function runScheduledBackupIfDue() {
  const latest = await prisma.backup.findFirst({ orderBy: { createdAt: "desc" } });
  if (latest && Date.now() - latest.createdAt.getTime() < BACKUP_INTERVAL_MS) {
    return null;
  }
  return runBackup({ createdBy: "system", kind: "scheduled" });
}

/** Restore from local backup file — management-only for production use. */
export async function restoreBackup(params: {
  backupId: string;
  actorUserId: string;
  ipAddress?: string | null;
}) {
  const backup = await prisma.backup.findUnique({ where: { id: params.backupId } });
  if (!backup) throw new Error("Backup not found");

  const filePath = path.join(BACKUP_DIR, backup.storageKey);
  const raw = await readFile(filePath, "utf8");
  const snapshot = JSON.parse(raw) as {
    goalScores?: Array<{
      staffName: string;
      monthId: string;
      kind: string;
      dayIndex: number;
      points: number;
    }>;
  };

  if (snapshot.goalScores?.length) {
    for (const gs of snapshot.goalScores) {
      await prisma.goalScore.upsert({
        where: {
          staffName_monthId_kind_dayIndex: {
            staffName: gs.staffName,
            monthId: gs.monthId,
            kind: gs.kind,
            dayIndex: gs.dayIndex
          }
        },
        create: gs,
        update: { points: gs.points }
      });
    }
  }

  await writeAuditLog({
    userId: params.actorUserId,
    action: "backup.restore",
    entityType: "backup",
    entityId: backup.id,
    ipAddress: params.ipAddress
  });

  return backup;
}
