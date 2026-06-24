import { NextRequest } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { jsonError, jsonOk, requireRole, getMeta } from "@/lib/api";
import { optionalCityIdSchema, discordIdSchema, usernameSchema } from "@/lib/user-fields";
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
        username: usernameSchema.optional(),
        cityId: optionalCityIdSchema,
        discordId: discordIdSchema,
        hiddenFromGoalTrackers: z.boolean().optional()
      })
      .parse(await req.json());
    const meta = getMeta(req);

    const updated = await users.updateUser({
      userId: body.userId,
      actorUserId: actor.id,
      actorRole: actor.role,
      role: body.role,
      username: body.username,
      cityId: body.cityId,
      discordId: body.discordId,
      hiddenFromGoalTrackers: body.hiddenFromGoalTrackers,
      ipAddress: meta.ipAddress
    });

    await publishAdminChange(actor.id, "users");

    return jsonOk({ user: updated });
  } catch (e) {
    return jsonError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const actor = await requireRole("aux");
    const body = z.object({ userId: z.string() }).parse(await req.json());
    const meta = getMeta(req);

    await users.deleteUser({
      userId: body.userId,
      actorUserId: actor.id,
      actorRole: actor.role,
      ipAddress: meta.ipAddress
    });

    await publishAdminChange(actor.id, "users");

    return jsonOk({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
