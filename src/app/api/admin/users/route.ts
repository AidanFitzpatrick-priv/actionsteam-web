import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { UserOrg, UserRole } from "@prisma/client";
import { ApiError, jsonError, jsonOk, requireRole, getMeta } from "@/lib/api";
import { isFullAdmin } from "@/lib/rbac";
import { cityIdSchema, optionalCityIdSchema, discordIdSchema, usernameSchema } from "@/lib/user-fields";
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
    const body = z.discriminatedUnion("action", [
      z.object({
        action: z.literal("resetPassword"),
        userId: z.string()
      }),
      z.object({
        action: z.literal("createUser"),
        username: usernameSchema,
        email: z.string().trim().email(),
        cityId: cityIdSchema,
        role: z.nativeEnum(UserRole).optional(),
        org: z.nativeEnum(UserOrg).nullable().optional()
      })
    ]).parse(await req.json());
    const meta = getMeta(req);

    if (body.action === "createUser") {
      const created = await users.createUser({
        actorUserId: actor.id,
        actorRole: actor.role,
        actorUsername: actor.username,
        username: body.username,
        email: body.email,
        cityId: body.cityId,
        role: body.role,
        org: body.org,
        ipAddress: meta.ipAddress
      });
      await publishAdminChange(actor.id, "users");
      const listed = await users.getListedUser(created.id);
      return jsonOk({ user: listed });
    }

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
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    if (e instanceof Error && !(e instanceof ApiError)) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return jsonError(e);
  }
}
