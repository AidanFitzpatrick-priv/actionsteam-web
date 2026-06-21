import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser, getRequestMeta, getSessionUser, SESSION_COOKIE } from "./session";
import { hasMinRole } from "./rbac";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
  }
}

export async function requireUser(): Promise<NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "Not authenticated");
  return user;
}

export async function requireRole(minRole: UserRole) {
  const user = await requireUser();
  if (!hasMinRole(user.role, minRole)) {
    throw new ApiError(403, "Insufficient permissions");
  }
  return user;
}

export async function requireUserFromRequest(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const user = await getSessionUser(token);
  if (!user) throw new ApiError(401, "Not authenticated");
  return user;
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  console.error(err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export function getMeta(req: NextRequest) {
  return getRequestMeta(req);
}
