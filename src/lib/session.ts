import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { User, UserRole } from "@prisma/client";
import { prisma } from "./db";
import { generateSessionToken, hashToken } from "./crypto";

export const SESSION_COOKIE = "actions_session";
export const REFRESH_COOKIE = "actions_refresh";
const SESSION_HOURS = 24;
const REFRESH_DAYS = 7;

export type SessionUser = Pick<User, "id" | "email" | "username" | "role" | "disabledAt" | "mustResetPassword">;

export async function createSession(
  userId: string,
  meta?: { ipAddress?: string | null; userAgent?: string | null }
): Promise<{ sessionToken: string; refreshToken: string }> {
  const sessionToken = generateSessionToken();
  const refreshToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(sessionToken),
      refreshTokenHash: hashToken(refreshToken),
      expiresAt,
      ipAddress: meta?.ipAddress ?? null,
      userAgent: meta?.userAgent ?? null
    }
  });

  return { sessionToken, refreshToken };
}

export async function deleteSessionByToken(sessionToken: string) {
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(sessionToken) } });
}

export async function getSessionUser(sessionToken: string | undefined): Promise<SessionUser | null> {
  if (!sessionToken) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(sessionToken) },
    include: { user: true }
  });
  if (!session || session.expiresAt < new Date()) return null;
  if (session.user.disabledAt) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    username: session.user.username,
    role: session.user.role,
    disabledAt: session.user.disabledAt,
    mustResetPassword: session.user.mustResetPassword
  };
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return getSessionUser(token);
}

export function getRequestMeta(req: NextRequest) {
  return {
    ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null,
    userAgent: req.headers.get("user-agent")
  };
}

export function sessionCookieOptions(maxAgeSeconds: number) {
  const secure = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds
  };
}

export function setSessionCookies(
  setCookie: (name: string, value: string, options: ReturnType<typeof sessionCookieOptions>) => void,
  sessionToken: string,
  refreshToken: string
) {
  setCookie(SESSION_COOKIE, sessionToken, sessionCookieOptions(SESSION_HOURS * 3600));
  setCookie(REFRESH_COOKIE, refreshToken, sessionCookieOptions(REFRESH_DAYS * 86400));
}

export function clearSessionCookies(
  deleteCookie: (name: string) => void
) {
  deleteCookie(SESSION_COOKIE);
  deleteCookie(REFRESH_COOKIE);
}

export type AuthContext = {
  user: SessionUser;
  role: UserRole;
};
