import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { formatAuditEvent, type AuditLookup } from "./audit-format";

export async function writeAuditLog(params: {
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  payload?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId ?? null,
      action: params.action,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      payload: params.payload ?? undefined,
      ipAddress: params.ipAddress ?? null
    }
  });
}

function idsOfType(
  logs: Array<{ entityType: string | null; entityId: string | null }>,
  entityType: string
): string[] {
  return [
    ...new Set(
      logs
        .filter(log => log.entityType === entityType && log.entityId)
        .map(log => log.entityId as string)
    )
  ];
}

export async function loadAuditLookups(
  logs: Array<{ entityType: string | null; entityId: string | null }>
): Promise<AuditLookup> {
  const trackerIds = idsOfType(logs, "tracker_row");
  const brTrackerIds = idsOfType(logs, "br_tracker_row");
  const monthIds = idsOfType(logs, "month");
  const gangIds = idsOfType(logs, "gang");
  const actionTypeIds = idsOfType(logs, "action_type");
  const userIds = idsOfType(logs, "user");
  const staffIds = idsOfType(logs, "staff");
  const actionLogIds = idsOfType(logs, "action_log");
  const backupIds = idsOfType(logs, "backup");

  const [trackerRows, brTrackerRows, months, gangs, actionTypes, users, staff, actionLogs, backups] =
    await Promise.all([
      trackerIds.length
        ? prisma.trackerRow.findMany({
            where: { id: { in: trackerIds } },
            select: {
              id: true,
              typeName: true,
              org1Name: true,
              org2Name: true,
              actionDate: true,
              month: { select: { name: true } }
            }
          })
        : [],
      brTrackerIds.length
        ? prisma.brTrackerRow.findMany({
            where: { id: { in: brTrackerIds } },
            select: {
              id: true,
              typeName: true,
              actionDate: true,
              month: { select: { name: true } }
            }
          })
        : [],
      monthIds.length
        ? prisma.month.findMany({
            where: { id: { in: monthIds } },
            select: { id: true, name: true }
          })
        : [],
      gangIds.length
        ? prisma.gang.findMany({
            where: { id: { in: gangIds } },
            select: { id: true, name: true }
          })
        : [],
      actionTypeIds.length
        ? prisma.actionType.findMany({
            where: { id: { in: actionTypeIds } },
            select: { id: true, name: true, kind: true }
          })
        : [],
      userIds.length
        ? prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, username: true }
          })
        : [],
      staffIds.length
        ? prisma.staff.findMany({
            where: { id: { in: staffIds } },
            select: { id: true, name: true }
          })
        : [],
      actionLogIds.length
        ? prisma.actionLog.findMany({
            where: { id: { in: actionLogIds } },
            select: { id: true, orgName: true, actionText: true }
          })
        : [],
      backupIds.length
        ? prisma.backup.findMany({
            where: { id: { in: backupIds } },
            select: { id: true, createdAt: true }
          })
        : []
    ]);

  return {
    trackerRows: Object.fromEntries(
      trackerRows.map(row => [
        row.id,
        {
          monthName: row.month.name,
          typeName: row.typeName,
          org1Name: row.org1Name,
          org2Name: row.org2Name,
          actionDate: row.actionDate
        }
      ])
    ),
    brTrackerRows: Object.fromEntries(
      brTrackerRows.map(row => [
        row.id,
        {
          monthName: row.month.name,
          typeName: row.typeName,
          actionDate: row.actionDate
        }
      ])
    ),
    months: Object.fromEntries(months.map(row => [row.id, row.name])),
    gangs: Object.fromEntries(gangs.map(row => [row.id, row.name])),
    actionTypes: Object.fromEntries(
      actionTypes.map(row => [row.id, { name: row.name, kind: row.kind }])
    ),
    users: Object.fromEntries(users.map(row => [row.id, row.username])),
    staff: Object.fromEntries(staff.map(row => [row.id, row.name])),
    actionLogs: Object.fromEntries(
      actionLogs.map(row => [row.id, { orgName: row.orgName, actionText: row.actionText }])
    ),
    backups: Object.fromEntries(backups.map(row => [row.id, { createdAt: row.createdAt }]))
  };
}

export async function listRecentAuditLogView(take = 50) {
  const logs = await prisma.auditLog.findMany({
    take,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { username: true } } }
  });
  const lookup = await loadAuditLookups(logs);
  return logs.map(log => {
    const formatted = formatAuditEvent(
      {
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        payload: log.payload
      },
      lookup
    );
    return {
      id: log.id,
      createdAt: log.createdAt,
      who: log.user?.username ?? "—",
      what: formatted.what,
      details: formatted.details
    };
  });
}
