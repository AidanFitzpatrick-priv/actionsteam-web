import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { jsonError, jsonOk, requireRole, getMeta } from "@/lib/api";
import { createInvite, listInvitesForUser } from "@/services/invites";
import { INVITE_DEFAULT_ROLE_OPTIONS } from "@/lib/rbac";

const createSchema = z.object({
  defaultRole: z.enum(["member", "sub_lead"] as [UserRole, ...UserRole[]]).optional(),
  expiresInDays: z.number().int().min(1).max(30).optional()
});

export async function GET() {
  try {
    const user = await requireRole("sub_lead");
    const invites = await listInvitesForUser(user.id, user.role);
    return jsonOk({ invites });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("sub_lead");
    const body = createSchema.parse(await req.json().catch(() => ({})));
    const defaultRole = body.defaultRole ?? "member";
    if (!INVITE_DEFAULT_ROLE_OPTIONS.includes(defaultRole)) {
      return NextResponse.json({ error: "Invalid default role for invite" }, { status: 400 });
    }

    const result = await createInvite({
      createdByUserId: user.id,
      defaultRole,
      expiresInDays: body.expiresInDays,
      ipAddress: getMeta(req).ipAddress
    });

    return jsonOk({
      invite: {
        id: result.invite.id,
        expiresAt: result.invite.expiresAt,
        defaultRole: result.invite.defaultRole,
        signupLink: result.signupLink
      }
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return jsonError(err);
  }
}
