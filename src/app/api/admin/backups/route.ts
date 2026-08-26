import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireRole, getMeta, ApiError } from "@/lib/api";
import { canViewBackups } from "@/lib/rbac";
import * as backups from "@/services/backups";

export async function GET() {
  try {
    const user = await requireRole("member");
    if (!canViewBackups(user.username)) {
      throw new ApiError(403, "Only the admin account can view backups");
    }
    const list = await backups.listBackups();
    return jsonOk({ backups: list });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("member");
    if (!canViewBackups(user.username)) {
      throw new ApiError(403, "Only the admin account can run backups");
    }
    getMeta(req);
    const record = await backups.runBackup({ createdBy: user.username, kind: "manual" });
    return jsonOk({ backup: record }, { status: 201 });
  } catch (e) {
    return jsonError(e);
  }
}
