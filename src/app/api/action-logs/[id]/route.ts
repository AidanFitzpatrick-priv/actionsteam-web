import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireRole, getMeta } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { publishActionLogChange } from "@/services/live-sync";
import { softDeleteActionLog } from "@/services/action-log";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireRole("member");
    const { id } = await ctx.params;
    await softDeleteActionLog({ actor: { id: user.id, role: user.role }, logId: id });

    await writeAuditLog({
      userId: user.id,
      action: "action_log.delete",
      entityType: "action_log",
      entityId: id,
      ipAddress: getMeta(req).ipAddress
    });

    await publishActionLogChange({
      actorId: user.id,
      action: "deleted",
      logId: id
    });

    return jsonOk({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
