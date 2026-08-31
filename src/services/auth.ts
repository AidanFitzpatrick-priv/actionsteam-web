import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { writeAuditLog } from "@/lib/audit";
import { consumeInvite, validateInviteToken } from "@/services/invites";

export async function signupWithInvite(params: {
  inviteToken: string;
  email: string;
  username: string;
  cityId: string;
  password: string;
  ipAddress?: string | null;
}) {
  const validation = await validateInviteToken(params.inviteToken);
  if (!validation.ok) throw new Error(validation.reason);

  const email = params.email.trim().toLowerCase();
  const username = params.username.trim();
  const cityId = params.cityId.trim();

  if (!cityId) throw new Error("City ID is required");

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { username }, { cityId }]
    }
  });
  if (existing) {
    if (existing.cityId === cityId) throw new Error("City ID is already registered");
    throw new Error("Email or username already taken");
  }

  if (params.password.length < 5) {
    throw new Error("Password must be at least 5 characters");
  }

  const passwordHash = await hashPassword(params.password);
  const user = await prisma.user.create({
    data: {
      email,
      username,
      cityId,
      passwordHash,
      role: "member"
    }
  });

  await consumeInvite({ rawToken: params.inviteToken, userId: user.id });

  await writeAuditLog({
    userId: user.id,
    action: "auth.signup",
    entityType: "invite",
    entityId: validation.invite.id,
    payload: { username: user.username, invitedBy: validation.invite.createdByUserId },
    ipAddress: params.ipAddress
  });

  return user;
}

export async function loginUser(params: {
  identifier: string;
  password: string;
  ipAddress?: string | null;
}) {
  const identifier = params.identifier.trim();

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: identifier.toLowerCase() },
        { username: { equals: identifier, mode: "insensitive" } }
      ]
    }
  });

  if (!user || user.disabledAt) {
    throw new Error("Invalid credentials");
  }

  // Admin password reset does not send email. The user only needs their
  // username/email; next sign-in skips the old password and asks them to set a new one.
  if (!user.mustResetPassword) {
    const valid = await verifyPassword(user.passwordHash, params.password);
    if (!valid) {
      throw new Error("Invalid credentials");
    }
  }

  await writeAuditLog({
    userId: user.id,
    action: "auth.login",
    ipAddress: params.ipAddress
  });

  return user;
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}
