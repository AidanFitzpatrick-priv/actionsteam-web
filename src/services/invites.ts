import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { generateSecureToken, hashToken } from "@/lib/crypto";
import { canViewAllInvites } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

const DEFAULT_EXPIRY_DAYS = 7;

export type InviteStatus = "pending" | "used" | "expired" | "revoked";

export function inviteStatus(invite: {
  revokedAt: Date | null;
  expiresAt: Date;
  useCount: number;
  maxUses: number;
}): InviteStatus {
  if (invite.revokedAt) return "revoked";
  if (invite.useCount >= invite.maxUses) return "used";
  if (invite.expiresAt < new Date()) return "expired";
  return "pending";
}

export async function createInvite(params: {
  createdByUserId: string;
  defaultRole?: UserRole;
  expiresInDays?: number;
  maxUses?: number;
  ipAddress?: string | null;
}) {
  const rawToken = generateSecureToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(
    Date.now() + (params.expiresInDays ?? DEFAULT_EXPIRY_DAYS) * 86400000
  );

  const invite = await prisma.invite.create({
    data: {
      tokenHash,
      createdByUserId: params.createdByUserId,
      expiresAt,
      maxUses: params.maxUses ?? 1,
      defaultRole: params.defaultRole ?? "member"
    },
    include: {
      createdBy: { select: { id: true, username: true, role: true } }
    }
  });

  await writeAuditLog({
    userId: params.createdByUserId,
    action: "invite.create",
    entityType: "invite",
    entityId: invite.id,
    payload: { defaultRole: invite.defaultRole, expiresAt: invite.expiresAt.toISOString() },
    ipAddress: params.ipAddress
  });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  return {
    invite,
    signupLink: `${appUrl}/signup?invite=${rawToken}`
  };
}

export async function listInvitesForUser(userId: string, role: UserRole) {
  const where = canViewAllInvites(role) ? {} : { createdByUserId: userId };
  const invites = await prisma.invite.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { id: true, username: true, role: true } },
      redeemedBy: { select: { id: true, username: true, createdAt: true } }
    }
  });

  return invites.map(i => ({
    id: i.id,
    createdBy: {
      id: i.createdBy.id,
      username: i.createdBy.username,
      role: i.createdBy.role
    },
    createdAt: i.createdAt,
    expiresAt: i.expiresAt,
    status: inviteStatus(i),
    defaultRole: i.defaultRole,
    useCount: i.useCount,
    maxUses: i.maxUses,
    usedBy: i.redeemedBy
      ? { username: i.redeemedBy.username, at: i.redeemedBy.createdAt }
      : null
  }));
}

export async function revokeInvite(params: {
  inviteId: string;
  actorUserId: string;
  actorRole: UserRole;
  ipAddress?: string | null;
}) {
  const invite = await prisma.invite.findUnique({ where: { id: params.inviteId } });
  if (!invite) throw new Error("Invite not found");
  if (inviteStatus(invite) !== "pending") throw new Error("Only pending invites can be revoked");

  const canRevokeAny = canViewAllInvites(params.actorRole);
  if (!canRevokeAny && invite.createdByUserId !== params.actorUserId) {
    throw new Error("Cannot revoke this invite");
  }

  await prisma.invite.update({
    where: { id: invite.id },
    data: { revokedAt: new Date() }
  });

  await writeAuditLog({
    userId: params.actorUserId,
    action: "invite.revoke",
    entityType: "invite",
    entityId: invite.id,
    ipAddress: params.ipAddress
  });
}

export async function regenerateInvite(params: {
  inviteId: string;
  actorUserId: string;
  actorRole: UserRole;
  ipAddress?: string | null;
}) {
  const old = await prisma.invite.findUnique({ where: { id: params.inviteId } });
  if (!old) throw new Error("Invite not found");
  if (inviteStatus(old) !== "pending") throw new Error("Only pending invites can be regenerated");

  const canRevokeAny = canViewAllInvites(params.actorRole);
  if (!canRevokeAny && old.createdByUserId !== params.actorUserId) {
    throw new Error("Cannot regenerate this invite");
  }

  await prisma.invite.update({
    where: { id: old.id },
    data: { revokedAt: new Date() }
  });

  return createInvite({
    createdByUserId: params.actorUserId,
    defaultRole: old.defaultRole,
    expiresInDays: Math.max(1, Math.ceil((old.expiresAt.getTime() - Date.now()) / 86400000)),
    maxUses: old.maxUses,
    ipAddress: params.ipAddress
  });
}

export async function validateInviteToken(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const invite = await prisma.invite.findUnique({
    where: { tokenHash },
    include: { createdBy: { select: { username: true } } }
  });
  if (!invite) return { ok: false as const, reason: "Invalid invite link" };
  const status = inviteStatus(invite);
  if (status === "revoked") return { ok: false as const, reason: "This invite was revoked" };
  if (status === "used") return { ok: false as const, reason: "This invite has already been used" };
  if (status === "expired") return { ok: false as const, reason: "This invite has expired" };
  return { ok: true as const, invite };
}

export async function consumeInvite(params: {
  rawToken: string;
  userId: string;
}) {
  const tokenHash = hashToken(params.rawToken);
  const invite = await prisma.invite.findUnique({ where: { tokenHash } });
  if (!invite || inviteStatus(invite) !== "pending") {
    throw new Error("Invite is no longer valid");
  }

  await prisma.$transaction([
    prisma.invite.update({
      where: { id: invite.id },
      data: { useCount: { increment: 1 } }
    }),
    prisma.user.update({
      where: { id: params.userId },
      data: { invitedViaInviteId: invite.id }
    })
  ]);

  return invite;
}
