import { NextRequest } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { jsonError, jsonOk, requireRole, getMeta } from "@/lib/api";
import { discordIdSchema } from "@/lib/user-fields";
import { publishAdminChange } from "@/services/live-sync";
import * as users from "@/services/users";

export async function GET() {
  try {
    await requireRole("aux");
    const list = await users.listUsers();
    return jsonOk({ users: list });
  } catch (e) {
    return jsonError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireRole("aux");
    const body = z
      .object({
        userId: z.string(),
        role: z.nativeEnum(UserRole).optional(),
        disabled: z.boolean().optional(),
        discordId: discordIdSchema
      })
      .parse(await req.json());
    const meta = getMeta(req);

    const updated = await users.updateUser({
      userId: body.userId,
      actorUserId: actor.id,
      actorRole: actor.role,
      role: body.role,
      disabled: body.disabled,
      discordId: body.discordId,
      ipAddress: meta.ipAddress
    });

    await publishAdminChange(actor.id, "users");

    return jsonOk({ user: updated });
  } catch (e) {
    return jsonError(e);
  }
}
