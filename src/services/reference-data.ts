import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

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
    ipAddress: params.ipAddress
  });

  return row;
}

export async function listActionTypes() {
  return prisma.actionType.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" }
  });
}

export async function upsertActionType(params: {
  id?: string;
  name: string;
  colourHex: string;
  actorUserId: string;
  ipAddress?: string | null;
}) {
  const data = {
    name: params.name.trim(),
    colourHex: params.colourHex.trim()
  };

  const row = params.id
    ? await prisma.actionType.update({ where: { id: params.id }, data })
    : await prisma.actionType.create({ data });

  await writeAuditLog({
    userId: params.actorUserId,
    action: params.id ? "action_type.update" : "action_type.create",
    entityType: "action_type",
    entityId: row.id,
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
  org2Eligible?: boolean;
  actorUserId: string;
  ipAddress?: string | null;
}) {
  const data = {
    name: params.name.trim(),
    org2Eligible: params.org2Eligible ?? true
  };

  const row = params.id
    ? await prisma.gang.update({ where: { id: params.id }, data })
    : await prisma.gang.create({ data });

  await writeAuditLog({
    userId: params.actorUserId,
    action: params.id ? "gang.update" : "gang.create",
    entityType: "gang",
    entityId: row.id,
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
    ipAddress: params.ipAddress
  });

  return row;
}

/** Dropdown options for tracker/schedule — PD first in org2 list. */
export async function getDropdownOptions() {
  const [staff, types, gangs, accountUsers] = await Promise.all([
    listStaff(),
    listActionTypes(),
    listGangs(),
    prisma.user.findMany({
      where: { disabledAt: null },
      orderBy: { username: "asc" },
      select: { username: true }
    })
  ]);

  const org1Names = gangs.map(g => g.name);
  const org2Names = ["PD", ...gangs.filter(g => g.org2Eligible).map(g => g.name)];

  return {
    staff: staff.filter(s => s.active).map(s => s.name),
    accountUsers: accountUsers.map(u => u.username),
    types: types.map(t => ({ name: t.name, colourHex: t.colourHex })),
    org1: org1Names,
    org2: org2Names,
    winners: [...org1Names, ...org2Names, "N/A"],
    statusOptions: [
      "Completed",
      "Actions Didn't Attend",
      "Org 1 Didn't Attend",
      "Org 2 Didn't Attend",
      "Gang Didn't Attend",
      "PD Didn't Attend"
    ]
  };
}
