import { prisma } from "@/lib/db";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCK_MS = 30 * 60 * 1000;

function attemptKey(ip: string, identifier: string) {
  return `${ip}:${identifier.toLowerCase()}`;
}

export async function checkLoginRateLimit(ip: string, identifier: string): Promise<string | null> {
  const key = attemptKey(ip, identifier);
  const row = await prisma.loginAttempt.findUnique({ where: { key } });
  const now = new Date();

  if (row?.lockedUntil && row.lockedUntil > now) {
    return "Too many login attempts. Try again later.";
  }

  if (!row || now.getTime() - row.windowStart.getTime() > WINDOW_MS) {
    return null;
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    await prisma.loginAttempt.update({
      where: { key },
      data: { lockedUntil: new Date(now.getTime() + LOCK_MS) }
    });
    return "Too many login attempts. Try again later.";
  }

  return null;
}

export async function recordLoginFailure(ip: string, identifier: string) {
  const key = attemptKey(ip, identifier);
  const now = new Date();
  const row = await prisma.loginAttempt.findUnique({ where: { key } });

  if (!row || now.getTime() - row.windowStart.getTime() > WINDOW_MS) {
    await prisma.loginAttempt.upsert({
      where: { key },
      create: { key, attempts: 1, windowStart: now },
      update: { attempts: 1, windowStart: now, lockedUntil: null }
    });
    return;
  }

  await prisma.loginAttempt.update({
    where: { key },
    data: { attempts: row.attempts + 1 }
  });
}

export async function clearLoginAttempts(ip: string, identifier: string) {
  const key = attemptKey(ip, identifier);
  await prisma.loginAttempt.deleteMany({ where: { key } });
}
