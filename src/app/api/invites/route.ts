import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk, requireRole, getMeta } from "@/lib/api";
import { createInvite, listInvitesForUser } from "@/services/invites";
import { publishInvitesChange } from "@/services/live-sync";

const createSchema = z.object({
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

    const result = await createInvite({
      createdByUserId: user.id,
      expiresInDays: body.expiresInDays,
      ipAddress: getMeta(req).ipAddress
    });

    await publishInvitesChange(user.id);

    return jsonOk({
      invite: {
        id: result.invite.id,
        expiresAt: result.invite.expiresAt,
        signupLink: result.signupLink
      }
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(new Error("Invalid input"));
    }
    return jsonError(err);
  }
}
