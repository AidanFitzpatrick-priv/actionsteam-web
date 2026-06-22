import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { writeAuditLog } from "@/lib/audit";
import { consumeInvite, validateInviteToken } from "@/services/invites";
import { clearLoginAttempts, checkLoginRateLimit, recordLoginFailure } from "@/lib/rate-limit";

export async function signupWithInvite(params: {
  inviteToken: string;
  email: string;
  username: string;
  password: string;
  ipAddress?: string | null;
}) {
  const validation = await validateInviteToken(params.inviteToken);
  if (!validation.ok) throw new Error(validation.reason);

  const email = params.email.trim().toLowerCase();
  const username = params.username.trim();

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] }
  });
  if (existing) throw new Error("Email or username already taken");

  if (params.password.length < 10) {
    throw new Error("Password must be at least 10 characters");
  }

  const passwordHash = await hashPassword(params.password);
  const user = await prisma.user.create({
    data: {
      email,
      username,
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
    payload: { invitedBy: validation.invite.createdByUserId },
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
  const ip = params.ipAddress ?? "unknown";

  const rateLimited = await checkLoginRateLimit(ip, identifier);
  if (rateLimited) throw new Error(rateLimited);

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier.toLowerCase() }, { username: identifier }]
    }
  });

  if (!user || user.disabledAt) {
    await recordLoginFailure(ip, identifier);
    throw new Error("Invalid credentials");
  }

  const valid = await verifyPassword(user.passwordHash, params.password);
  if (!valid) {
    await recordLoginFailure(ip, identifier);
    throw new Error("Invalid credentials");
  }

  await clearLoginAttempts(ip, identifier);

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
