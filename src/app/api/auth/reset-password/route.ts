import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk, requireUser, getMeta } from "@/lib/api";
import { hashPassword } from "@/lib/crypto";
import { writeAuditLog } from "@/lib/audit";
import { passwordSchema } from "@/lib/user-fields";
import { prisma } from "@/lib/db";
import {
  completePasswordResetWithToken,
  validatePasswordResetToken
} from "@/services/password-reset";

const bodySchema = z
  .object({
    token: z.string().optional(),
    password: passwordSchema,
    passwordConfirm: z.string()
  })
  .refine(data => data.password === data.passwordConfirm, {
    message: "Passwords do not match",
    path: ["passwordConfirm"]
  });

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    if (!token) return jsonOk({ valid: false });
    const result = await validatePasswordResetToken(token);
    return jsonOk(result);
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = bodySchema.parse(await req.json());
    const meta = getMeta(req);

    if (body.token) {
      await completePasswordResetWithToken({
        rawToken: body.token,
        password: body.password,
        ipAddress: meta.ipAddress
      });
      return jsonOk({ ok: true });
    }

    const user = await requireUser();
    if (!user.mustResetPassword) {
      return jsonOk({ ok: true, alreadySet: true });
    }

    const passwordHash = await hashPassword(body.password);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustResetPassword: false }
    });

    await writeAuditLog({
      userId: user.id,
      action: "auth.password_reset",
      entityType: "user",
      entityId: user.id,
      payload: { via: "admin_required" },
      ipAddress: meta.ipAddress
    });

    return jsonOk({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
