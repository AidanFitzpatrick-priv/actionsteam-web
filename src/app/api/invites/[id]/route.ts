import { NextRequest, NextResponse } from "next/server";
import { jsonError, jsonOk, requireRole, getMeta, ApiError } from "@/lib/api";
import { revokeInvite, regenerateInvite } from "@/services/invites";
import { publishInvitesChange } from "@/services/live-sync";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireRole("sub_lead");
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "revoke") {
      await revokeInvite({
        inviteId: id,
        actorUserId: user.id,
        actorRole: user.role,
        ipAddress: getMeta(req).ipAddress
      });
      await publishInvitesChange(user.id);
      return jsonOk({ ok: true });
    }

    if (action === "regenerate") {
      const result = await regenerateInvite({
        inviteId: id,
        actorUserId: user.id,
        actorRole: user.role,
        ipAddress: getMeta(req).ipAddress
      });
      await publishInvitesChange(user.id);
      return jsonOk({
        invite: {
          id: result.invite.id,
          signupLink: result.signupLink,
          expiresAt: result.invite.expiresAt
        }
      });
    }

    return jsonError(new ApiError(400, "Unknown action"));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(new ApiError(400, message));
  }
}
