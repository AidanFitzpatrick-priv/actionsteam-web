import { UserOrg, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { generateSecureToken, hashPassword } from "@/lib/crypto";
import { writeAuditLog } from "@/lib/audit";
import { formatRole, canEditUserRole, canAssignRole, canEditUsername, canDeleteUser, canManageGoalTrackerVisibility, canResetUserPassword, isProtectedAdminAccount } from "@/lib/rbac";
import { cityIdSchema, usernameSchema } from "@/lib/user-fields";
import { publishUserGoalSync, removeUserFromGoalData, renameUserDisplayNameInSources, recalculateNonArchivedMonths } from "@/services/user-sync";

const listedUserSelect = {
  id: true,
  username: true,
  cityId: true,
  role: true,
  org: true,
  hiddenFromGoalTrackers: true,
  mustResetPassword: true,
  createdAt: true,
  invitedViaInvite: {
    select: {
      createdBy: { select: { username: true } }
    }
  }
} as const;

function toListedUser(u: {
  id: string;
  username: string;
  cityId: string | null;
  role: UserRole;
  org: UserOrg | null;
  hiddenFromGoalTrackers: boolean;
  mustResetPassword: boolean;
  createdAt: Date;
  invitedViaInvite: { createdBy: { username: string } | null } | null;
}) {
  return {
    id: u.id,
    username: u.username,
    cityId: u.cityId,
    role: u.role,
    roleLabel: formatRole(u.role),
    org: u.org,
    hiddenFromGoalTrackers: u.hiddenFromGoalTrackers,
    mustResetPassword: u.mustResetPassword,
    createdAt: u.createdAt,
    invitedBy: u.invitedViaInvite?.createdBy?.username ?? null
  };
}

export async function listUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: listedUserSelect
  });

  return users
    .filter(u => !isProtectedAdminAccount(u.username))
    .map(toListedUser);
}

export async function createUser(params: {
  actorUserId: string;
  actorRole: UserRole;
  actorUsername: string;
  username: string;
  email: string;
  cityId: string;
  role?: UserRole;
  org?: UserOrg | null;
  ipAddress?: string | null;
}) {
  const username = usernameSchema.parse(params.username);
  const email = params.email.trim().toLowerCase();
  const cityId = cityIdSchema.parse(params.cityId);
  const role = params.role ?? "member";
  const org = params.org ?? null;

  if (isProtectedAdminAccount(username)) {
    throw new Error("That username is reserved");
  }

  if (!canAssignRole(params.actorRole, role)) {
    throw new Error("You cannot assign that role");
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        { username: { equals: username, mode: "insensitive" } },
        { cityId }
      ]
    }
  });
  if (existing) {
    if (existing.email === email) throw new Error("Email is already taken");
    if (existing.cityId === cityId) throw new Error("City ID is already registered");
    throw new Error("Username is already taken");
  }

  const passwordHash = await hashPassword(generateSecureToken(32));
  const user = await prisma.user.create({
    data: {
      username,
      email,
      cityId,
      passwordHash,
      role,
      org,
      mustResetPassword: true
    }
  });

  await writeAuditLog({
    userId: params.actorUserId,
    action: "user.create",
    entityType: "user",
    entityId: user.id,
    payload: { username: user.username, email: user.email, role: user.role, cityId: user.cityId, org: user.org },
    ipAddress: params.ipAddress
  });

  return user;
}

export async function getListedUser(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: listedUserSelect
  });
  if (!u) return null;
  return toListedUser(u);
}

export async function updateUser(params: {
  userId: string;
  actorUserId: string;
  actorRole: UserRole;
  actorUsername: string;
  role?: UserRole;
  username?: string;
  cityId?: string | null;
  discordId?: string | null;
  org?: UserOrg | null;
  hiddenFromGoalTrackers?: boolean;
  ipAddress?: string | null;
}) {
  const target = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!target) throw new Error("User not found");

  if (
    isProtectedAdminAccount(target.username) &&
    !isProtectedAdminAccount(params.actorUsername)
  ) {
    throw new Error("The admin account cannot be modified");
  }

  if (params.role !== undefined) {
    if (!canEditUserRole(params.actorRole, target.role, target.username, params.actorUsername)) {
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
    if (isProtectedAdminAccount(target.username) && username.toLowerCase() !== target.username.toLowerCase()) {
      throw new Error("The admin account cannot be renamed");
    }
    if (isProtectedAdminAccount(username) && !isProtectedAdminAccount(target.username)) {
      throw new Error("That username is reserved");
    }
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
    org?: UserOrg | null;
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
  if (params.org !== undefined) {
    data.org = params.org;
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
      org: params.org,
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

export async function resetUserPassword(params: {
  userId: string;
  actorUserId: string;
  actorRole: UserRole;
  actorUsername: string;
  ipAddress?: string | null;
}) {
  const target = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!target) throw new Error("User not found");

  if (target.id === params.actorUserId) {
    throw new Error("You cannot reset your own password here");
  }

  if (!canResetUserPassword(params.actorRole, target.role, target.username, params.actorUsername)) {
    throw new Error("You cannot reset the password of someone at or above your rank");
  }

  const updated = await prisma.user.update({
    where: { id: params.userId },
    data: { mustResetPassword: true }
  });

  await prisma.session.deleteMany({ where: { userId: params.userId } });

  await writeAuditLog({
    userId: params.actorUserId,
    action: "user.reset_password",
    entityType: "user",
    entityId: params.userId,
    payload: { username: target.username },
    ipAddress: params.ipAddress
  });

  return updated;
}

export async function deleteUser(params: {
  userId: string;
  actorUserId: string;
  actorRole: UserRole;
  actorUsername: string;
  ipAddress?: string | null;
}) {
  const target = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!target) throw new Error("User not found");

  if (target.id === params.actorUserId) {
    throw new Error("You cannot delete your own account");
  }

  if (!canDeleteUser(params.actorRole, target.role, target.username, params.actorUsername)) {
    throw new Error("You cannot delete this account");
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
