import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { formatRole, canEditUserRole, canAssignRole, canEditUsername, canDeleteUser, canManageGoalTrackerVisibility } from "@/lib/rbac";
import { usernameSchema } from "@/lib/user-fields";
import { publishUserGoalSync, removeUserFromGoalData, renameUserDisplayNameInSources, recalculateNonArchivedMonths } from "@/services/user-sync";

export async function listUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      invitedViaInvite: {
        include: { createdBy: { select: { username: true } } }
      }
    }
  });

  return users.map(u => ({
    id: u.id,
    email: u.email,
    username: u.username,
    cityId: u.cityId,
    discordId: u.discordId,
    role: u.role,
    roleLabel: formatRole(u.role),
    hiddenFromGoalTrackers: u.hiddenFromGoalTrackers,
    createdAt: u.createdAt,
    invitedBy: u.invitedViaInvite?.createdBy?.username ?? null
  }));
}

export async function updateUser(params: {
  userId: string;
  actorUserId: string;
  actorRole: UserRole;
  role?: UserRole;
  username?: string;
  cityId?: string | null;
  discordId?: string | null;
  hiddenFromGoalTrackers?: boolean;
  ipAddress?: string | null;
}) {
  const target = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!target) throw new Error("User not found");

  if (params.role !== undefined) {
    if (!canEditUserRole(params.actorRole, target.role)) {
      throw new Error("You cannot change the role of someone at or above your rank");
    }
    if (!canAssignRole(params.actorRole, params.role)) {
      throw new Error("You cannot assign that role");
    }
    if (params.role === "management" && params.actorRole !== "management") {
      throw new Error("Only management can assign the management role");
    }
    if (target.id === params.actorUserId && params.role !== target.role) {
      throw new Error("You cannot change your own role");
    }
  }

  if (params.username !== undefined) {
    if (!canEditUsername(params.actorRole)) {
      throw new Error("You cannot edit usernames");
    }
    const username = usernameSchema.parse(params.username);
    const taken = await prisma.user.findFirst({
      where: { username, NOT: { id: params.userId } }
    });
    if (taken) throw new Error("Username is already taken");
  }

  if (params.hiddenFromGoalTrackers !== undefined) {
    if (!canManageGoalTrackerVisibility(params.actorRole)) {
      throw new Error("Only management can change goal tracker visibility");
    }
  }

  const usernameChanging =
    params.username !== undefined &&
    usernameSchema.parse(params.username) !== target.username;

  if (usernameChanging) {
    await renameUserDisplayNameInSources(target.username, params.username!);
  }

  if (params.cityId !== undefined && params.cityId?.trim()) {
    const cityId = params.cityId.trim();
    const taken = await prisma.user.findFirst({
      where: { cityId, NOT: { id: params.userId } }
    });
    if (taken) throw new Error("City ID is already registered");
  }

  const data: {
    role?: UserRole;
    username?: string;
    cityId?: string | null;
    discordId?: string | null;
    hiddenFromGoalTrackers?: boolean;
  } = {};
  if (params.role !== undefined) data.role = params.role;
  if (params.username !== undefined) {
    data.username = usernameSchema.parse(params.username);
  }
  if (params.cityId !== undefined) {
    data.cityId = params.cityId?.trim() || null;
  }
  if (params.discordId !== undefined) {
    data.discordId = params.discordId?.trim() || null;
  }
  if (params.hiddenFromGoalTrackers !== undefined) {
    data.hiddenFromGoalTrackers = params.hiddenFromGoalTrackers;
  }

  const hiddenChanging =
    params.hiddenFromGoalTrackers !== undefined &&
    params.hiddenFromGoalTrackers !== target.hiddenFromGoalTrackers;

  const updated = await prisma.user.update({
    where: { id: params.userId },
    data
  });

  await writeAuditLog({
    userId: params.actorUserId,
    action: "user.update",
    entityType: "user",
    entityId: params.userId,
    payload: {
      role: params.role,
      username: params.username,
      cityId: params.cityId,
      discordId: params.discordId,
      hiddenFromGoalTrackers: params.hiddenFromGoalTrackers
    },
    ipAddress: params.ipAddress
  });

  if (usernameChanging) {
    await recalculateNonArchivedMonths();
    await publishUserGoalSync(params.actorUserId);
  }

  if (hiddenChanging) {
    await recalculateNonArchivedMonths();
    await publishUserGoalSync(params.actorUserId);
  }

  return updated;
}

export async function deleteUser(params: {
  userId: string;
  actorUserId: string;
  actorRole: UserRole;
  ipAddress?: string | null;
}) {
  const target = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!target) throw new Error("User not found");

  if (target.id === params.actorUserId) {
    throw new Error("You cannot delete your own account");
  }

  if (!canDeleteUser(params.actorRole, target.role)) {
    throw new Error("You cannot delete someone at or above your rank");
  }

  const deletedUsername = target.username;

  await removeUserFromGoalData(deletedUsername);

  await prisma.$transaction([
    prisma.invite.deleteMany({ where: { createdByUserId: params.userId } }),
    prisma.user.delete({ where: { id: params.userId } })
  ]);

  await recalculateNonArchivedMonths();

  await writeAuditLog({
    userId: params.actorUserId,
    action: "user.delete",
    entityType: "user",
    entityId: params.userId,
    payload: { username: target.username, email: target.email, role: target.role },
    ipAddress: params.ipAddress
  });

  await publishUserGoalSync(params.actorUserId);

  return { ok: true };
}
