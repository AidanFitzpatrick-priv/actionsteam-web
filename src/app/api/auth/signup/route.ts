import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk, getMeta, ApiError } from "@/lib/api";
import { signupWithInvite } from "@/services/auth";
import { createSession, sessionCookieOptions, SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/session";

const schema = z.object({
  inviteToken: z.string().min(10),
  email: z.string().email(),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_\-]+$/),
  password: z.string().min(10),
  passwordConfirm: z.string().min(10)
}).refine(d => d.password === d.passwordConfirm, {
  message: "Passwords do not match",
  path: ["passwordConfirm"]
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const meta = getMeta(req);
    const user = await signupWithInvite({
      inviteToken: body.inviteToken,
      email: body.email,
      username: body.username,
      password: body.password,
      ipAddress: meta.ipAddress
    });

    const { sessionToken, refreshToken } = await createSession(user.id, meta);
    const res = jsonOk({ ok: true, username: user.username });
    res.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions(86400));
    res.cookies.set(REFRESH_COOKIE, refreshToken, sessionCookieOptions(604800));
    return res;
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return jsonError(new ApiError(400, err instanceof Error ? err.message : "Sign up failed"));
  }
}
