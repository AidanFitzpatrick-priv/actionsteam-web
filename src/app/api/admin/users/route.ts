import { NextRequest } from "next/server";
import { z } from "zod";
import { UserOrg, UserRole } from "@prisma/client";
import { jsonError, jsonOk, requireRole, getMeta } from "@/lib/api";
import { isFullAdmin } from "@/lib/rbac";
import { optionalCityIdSchema, discordIdSchema, usernameSchema } from "@/lib/user-fields";
import { publishAdminChange } from "@/services/live-sync";
import * as users from "@/services/users";

export async function GET() {
  try {
    const actor = await requireRole("member");
    if (isFullAdmin(actor.role)) {
      const list = await users.listUsers();
      return jsonOk({ users: list });
    }
    const self = await users.getListedUser(actor.id);
    return jsonOk({ users: self ? [self] : [] });
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
        org: z.nativeEnum(UserOrg).nullable().optional(),
        hiddenFromGoalTrackers: z.boolean().optional()
      })
      .parse(await req.json());
    const meta = getMeta(req);

    await users.updateUser({
      userId: body.userId,
      actorUserId: actor.id,
      actorRole: actor.role,
      actorUsername: actor.username,
      role: body.role,
      username: body.username,
      cityId: body.cityId,
      discordId: body.discordId,
      org: body.org,
      hiddenFromGoalTrackers: body.hiddenFromGoalTrackers,
      ipAddress: meta.ipAddress
    });

    await publishAdminChange(actor.id, "users");

    const listed = await users.getListedUser(body.userId);
    return jsonOk({ user: listed });
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
      actorUsername: actor.username,
      ipAddress: meta.ipAddress
    });

    await publishAdminChange(actor.id, "users");

    return jsonOk({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole("aux");
    const body = z
      .object({
        userId: z.string(),
        action: z.literal("resetPassword")
      })
      .parse(await req.json());
    const meta = getMeta(req);

    await users.resetUserPassword({
      userId: body.userId,
      actorUserId: actor.id,
      actorRole: actor.role,
      actorUsername: actor.username,
      ipAddress: meta.ipAddress
    });

    await publishAdminChange(actor.id, "users");

    return jsonOk({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
