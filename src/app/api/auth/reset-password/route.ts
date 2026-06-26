import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk, requireUser, getMeta } from "@/lib/api";
import { hashPassword } from "@/lib/crypto";
import { writeAuditLog } from "@/lib/audit";
import { passwordSchema } from "@/lib/user-fields";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!user.mustResetPassword) {
      return jsonOk({ ok: true, alreadySet: true });
    }

    const body = z
      .object({
        password: passwordSchema,
        passwordConfirm: z.string()
      })
      .refine(data => data.password === data.passwordConfirm, {
        message: "Passwords do not match",
        path: ["passwordConfirm"]
      })
      .parse(await req.json());

    const meta = getMeta(req);
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
      ipAddress: meta.ipAddress
    });

    return jsonOk({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
