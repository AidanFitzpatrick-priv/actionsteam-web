import { prisma } from "@/lib/db";
import { generateSecureToken, hashPassword, hashToken } from "@/lib/crypto";
import { sendPasswordResetEmail } from "@/lib/email";
import { writeAuditLog } from "@/lib/audit";
import { checkForgotPasswordRateLimit, recordForgotPasswordAttempt } from "@/lib/rate-limit";

const TOKEN_TTL_MS = 60 * 60 * 1000;

export async function requestPasswordReset(params: {
  email: string;
  ipAddress?: string | null;
}) {
  const email = params.email.trim().toLowerCase();
  if (!email) return { ok: true as const };

  const ip = params.ipAddress ?? "unknown";
  const rateLimited = await checkForgotPasswordRateLimit(ip, email);
  if (rateLimited) throw new Error(rateLimited);

  await recordForgotPasswordAttempt(ip, email);

  const user = await prisma.user.findFirst({
    where: { email, disabledAt: null }
  });

  if (!user) return { ok: true as const };

  const rawToken = generateSecureToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() }
  });

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt }
  });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

  await sendPasswordResetEmail({
    to: user.email,
    username: user.username,
    resetUrl
  });

  await writeAuditLog({
    userId: user.id,
    action: "auth.forgot_password",
    entityType: "user",
    entityId: user.id,
    ipAddress: params.ipAddress
  });

  return { ok: true as const };
}

export async function validatePasswordResetToken(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { disabledAt: true } } }
  });
  if (!row || row.usedAt || row.expiresAt < new Date() || row.user.disabledAt) {
    return { valid: false as const };
  }
  return { valid: true as const };
}

export async function completePasswordResetWithToken(params: {
  rawToken: string;
  password: string;
  ipAddress?: string | null;
}) {
  const tokenHash = hashToken(params.rawToken);
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

  if (!row || row.usedAt || row.expiresAt < new Date()) {
    throw new Error("This reset link is invalid or has expired");
  }
  if (row.user.disabledAt) {
    throw new Error("This account is disabled");
  }

  const passwordHash = await hashPassword(params.password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash, mustResetPassword: false }
    }),
    prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() }
    }),
    prisma.session.deleteMany({ where: { userId: row.userId } })
  ]);

  await writeAuditLog({
    userId: row.userId,
    action: "auth.password_reset",
    entityType: "user",
    entityId: row.userId,
    payload: { via: "email" },
    ipAddress: params.ipAddress
  });

  return { ok: true as const };
}
