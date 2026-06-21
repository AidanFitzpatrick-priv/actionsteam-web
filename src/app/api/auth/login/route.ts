import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk, getMeta } from "@/lib/api";
import { loginUser } from "@/services/auth";
import { createSession, sessionCookieOptions, SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/session";

const schema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1)
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const meta = getMeta(req);
    const user = await loginUser({
      identifier: body.identifier,
      password: body.password,
      ipAddress: meta.ipAddress
    });

    const { sessionToken, refreshToken } = await createSession(user.id, meta);
    const res = jsonOk({
      ok: true,
      username: user.username,
      role: user.role,
      mustResetPassword: user.mustResetPassword
    });
    res.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions(86400));
    res.cookies.set(REFRESH_COOKIE, refreshToken, sessionCookieOptions(604800));
    return res;
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
