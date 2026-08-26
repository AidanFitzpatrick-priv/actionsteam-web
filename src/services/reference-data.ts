import { ActionTypeKind, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { shouldShowOnGoalTracker } from "@/lib/rbac";

export async function listStaff() {
  return prisma.staff.findMany({
    where: { deletedAt: null },
    orderBy: [{ rank: "asc" }, { name: "asc" }]
  });
}

export async function upsertStaff(params: {
  id?: string;
  name: string;
  rank?: string | null;
  active?: boolean;
  actorUserId: string;
  ipAddress?: string | null;
}) {
  const data = {
    name: params.name.trim(),
    rank: params.rank?.trim() || null,
    active: params.active ?? true
  };

  const row = params.id
    ? await prisma.staff.update({ where: { id: params.id }, data })
    : await prisma.staff.create({ data });

  await writeAuditLog({
    userId: params.actorUserId,
    action: params.id ? "staff.update" : "staff.create",
    entityType: "staff",
    entityId: row.id,
    payload: { name: row.name },
    ipAddress: params.ipAddress
  });

  return row;
}

export async function softDeleteStaff(params: {
  id: string;
  actorUserId: string;
  ipAddress?: string | null;
}) {
  const row = await prisma.staff.update({
    where: { id: params.id },
    data: { deletedAt: new Date(), active: false }
  });

  await writeAuditLog({
    userId: params.actorUserId,
    action: "staff.soft_delete",
    entityType: "staff",
    entityId: params.id,
    payload: { name: row.name },
    ipAddress: params.ipAddress
  });

  return row;
}

export async function listActionTypes(kind?: ActionTypeKind) {
  return prisma.actionType.findMany({
    where: { deletedAt: null, ...(kind ? { kind } : {}) },
    orderBy: { name: "asc" }
  });
}

export const BR_ACTION_TYPE_NAMES = ["City BR", "Cayo BR", "Sandy BR"] as const;

/** Action types bookable on schedule but hidden from the action tracker dropdown. */
export const TRACKER_HIDDEN_ACTION_TYPE_NAMES = ["Actions Meeting", "Staff Meeting"] as const;

export function isHiddenFromActionTracker(typeName: string): boolean {
  const normalized = typeName.trim().toLowerCase();
  return TRACKER_HIDDEN_ACTION_TYPE_NAMES.some(n => n.toLowerCase() === normalized);
}

export function filterTypesForActionTracker<T extends { name: string }>(types: T[]): T[] {
  return types.filter(t => !isHiddenFromActionTracker(t.name));
}

const BR_TYPE_SEEDS: { name: string; colourHex: string }[] = [
  { name: "City BR", colourHex: "#d9d2e9" },
  { name: "Cayo BR", colourHex: "#cfe2f3" },
  { name: "Sandy BR", colourHex: "#fce5cd" }
];

/** Ensure BR action types exist and are tagged kind=br. */
export async function ensureBrActionTypes() {
  for (const t of BR_TYPE_SEEDS) {
    await prisma.actionType.upsert({
      where: { name: t.name },
      create: { name: t.name, colourHex: t.colourHex, kind: "br" },
      update: { kind: "br", colourHex: t.colourHex, deletedAt: null }
    });
  }
}

export async function upsertActionType(params: {
  id?: string;
  name: string;
  colourHex: string;
  kind?: ActionTypeKind;
  actorUserId: string;
  ipAddress?: string | null;
}) {
  const data = {
    name: params.name.trim(),
    colourHex: params.colourHex.trim(),
    kind: params.kind ?? "action"
  };

  const previous = params.id
    ? await prisma.actionType.findUnique({ where: { id: params.id } })
    : null;

  const row = await prisma.$transaction(async tx => {
    const saved = params.id
      ? await tx.actionType.update({ where: { id: params.id }, data })
      : await tx.actionType.create({ data });

    const oldName = previous?.name?.trim();
    if (oldName && oldName !== saved.name) {
      await tx.scheduleSlot.updateMany({
        where: { typeName: oldName },
        data: { typeName: saved.name }
      });
      await tx.trackerRow.updateMany({
        where: { typeName: oldName },
        data: { typeName: saved.name }
      });
      await tx.brTrackerRow.updateMany({
        where: { typeName: oldName },
        data: { typeName: saved.name }
      });
    }

    return saved;
  });

  await writeAuditLog({
    userId: params.actorUserId,
    action: params.id ? "action_type.update" : "action_type.create",
    entityType: "action_type",
    entityId: row.id,
    payload: {
      name: row.name,
      kind: row.kind,
      ...(previous?.name && previous.name !== row.name ? { oldName: previous.name } : {})
    },
    ipAddress: params.ipAddress
  });

  return row;
}

export async function softDeleteActionType(params: {
  id: string;
  actorUserId: string;
  ipAddress?: string | null;
}) {
  const row = await prisma.actionType.update({
    where: { id: params.id },
    data: { deletedAt: new Date() }
  });

  await writeAuditLog({
    userId: params.actorUserId,
    action: "action_type.soft_delete",
    entityType: "action_type",
    entityId: params.id,
    payload: { name: row.name, kind: row.kind },
    ipAddress: params.ipAddress
  });

  return row;
}

export async function listGangs() {
  return prisma.gang.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" }
  });
}

export async function upsertGang(params: {
  id?: string;
  name: string;
  actorUserId: string;
  ipAddress?: string | null;
}) {
  const data = {
    name: params.name.trim(),
    org2Eligible: true
  };

  const previous = params.id
    ? await prisma.gang.findUnique({ where: { id: params.id } })
    : null;

  const row = await prisma.$transaction(async tx => {
    const saved = params.id
      ? await tx.gang.update({ where: { id: params.id }, data })
      : await tx.gang.create({ data });

    const oldName = previous?.name?.trim();
    if (oldName && oldName !== saved.name) {
      await tx.scheduleSlot.updateMany({
        where: { orgName: oldName },
        data: { orgName: saved.name }
      });
      await tx.trackerRow.updateMany({
        where: { org1Name: oldName },
        data: { org1Name: saved.name }
      });
      await tx.trackerRow.updateMany({
        where: { org2Name: oldName },
        data: { org2Name: saved.name }
      });
      await tx.trackerRow.updateMany({
        where: { actionWinner: oldName },
        data: { actionWinner: saved.name }
      });
      await tx.actionLog.updateMany({
        where: { orgName: oldName },
        data: { orgName: saved.name }
      });
    }

    return saved;
  });

  await writeAuditLog({
    userId: params.actorUserId,
    action: params.id ? "gang.update" : "gang.create",
    entityType: "gang",
    entityId: row.id,
    payload: {
      name: row.name,
      ...(previous?.name && previous.name !== row.name ? { oldName: previous.name } : {})
    },
    ipAddress: params.ipAddress
  });

  return row;
}

export async function softDeleteGang(params: {
  id: string;
  actorUserId: string;
  ipAddress?: string | null;
}) {
  const row = await prisma.gang.update({
    where: { id: params.id },
    data: { deletedAt: new Date() }
  });

  await writeAuditLog({
    userId: params.actorUserId,
    action: "gang.soft_delete",
    entityType: "gang",
    entityId: params.id,
    payload: { name: row.name },
    ipAddress: params.ipAddress
  });

  return row;
}

/** Status dropdown options for the action tracker. */
export const ACTION_STATUS_OPTIONS = [
  "Completed",
  "Org 1 Didn't Attend",
  "Org 2 Didn't Attend",
  "Actions Didn't Attend"
] as const;

/** Status dropdown options for the BR tracker. */
export const BR_STATUS_OPTIONS = ["Completed", "Actions Didn't Attend"] as const;

/** Status dropdown options for tracker surfaces. */
export function statusOptionsForTypeKind(typeKind?: ActionTypeKind): string[] {
  return typeKind === "br" ? [...BR_STATUS_OPTIONS] : [...ACTION_STATUS_OPTIONS];
}

export function isAllowedTrackerStatus(value: string, typeKind?: ActionTypeKind): boolean {
  return statusOptionsForTypeKind(typeKind).includes(value);
}

/** Dropdown options for tracker/schedule — PD first in org2 list. */
export async function getDropdownOptions(opts?: {
  typeKind?: ActionTypeKind;
  /** Action tracker: action types only, minus meeting types. */
  actionTracker?: boolean;
  /** Schedule grid: all bookable types (actions, meetings, and BRs). */
  schedule?: boolean;
}) {
  const typeKind = opts?.schedule ? undefined : opts?.typeKind;
  const [staff, types, gangs, accountUsers] = await Promise.all([
    listStaff(),
    listActionTypes(typeKind),
    listGangs(),
    prisma.user.findMany({
      where: { disabledAt: null },
      orderBy: { username: "asc" },
      select: { username: true, role: true, hiddenFromGoalTrackers: true }
    })
  ]);

  const org1Names = gangs.map(g => g.name);
  const org2Names = ["PD", ...org1Names];

  const visibleTypes = opts?.actionTracker ? filterTypesForActionTracker(types) : types;

  return {
    staff: staff.filter(s => s.active).map(s => s.name),
    accountUsers: accountUsers
      .filter(u => shouldShowOnGoalTracker(u.role as UserRole, u.hiddenFromGoalTrackers))
      .map(u => u.username),
    types: visibleTypes.map(t => ({ name: t.name, colourHex: t.colourHex, kind: t.kind })),
    org1: org1Names,
    org2: org2Names,
    statusOptions: statusOptionsForTypeKind(typeKind)
  };
}
