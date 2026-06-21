import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api";
import { validateInviteToken } from "@/services/invites";

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    if (!token) return jsonOk({ valid: false, reason: "Missing token" });
    const result = await validateInviteToken(token);
    if (!result.ok) return jsonOk({ valid: false, reason: result.reason });
    return jsonOk({
      valid: true,
      defaultRole: result.invite.defaultRole,
      invitedBy: result.invite.createdBy.username
    });
  } catch (err) {
    return jsonError(err);
  }
}
