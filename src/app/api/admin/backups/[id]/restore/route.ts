import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireRole, getMeta, ApiError } from "@/lib/api";
import * as backups from "@/services/backups";
import { canRestoreProduction, canViewBackups } from "@/lib/rbac";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireRole("member");
    if (!canViewBackups(user.role)) {
      throw new ApiError(403, "Only adm or management can access backups");
    }
    if (!canRestoreProduction(user.role)) {
      throw new ApiError(403, "Production restore requires management role");
    }
    const { id } = await ctx.params;
    const meta = getMeta(req);
    const backup = await backups.restoreBackup({
      backupId: id,
      actorUserId: user.id,
      ipAddress: meta.ipAddress
    });
    return jsonOk({ backup });
  } catch (e) {
    return jsonError(e);
  }
}
