import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk, requireRole, getMeta } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { publishActionLogChange } from "@/services/live-sync";
import { createActionLog, listActionLogsForViewer } from "@/services/action-log";

const postSchema = z.object({
  orgName: z.string(),
  actionText: z.string(),
  result: z.enum(["positive", "negative"]),
  positiveNumber: z.number().finite().nullable().optional(),
  negativeReason: z.string().nullable().optional(),
  proofUrl: z.string()
});

export async function GET() {
  try {
    const user = await requireRole("member");
    const data = await listActionLogsForViewer({ id: user.id, role: user.role });
    return jsonOk(data);
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("member");
    const body = postSchema.parse(await req.json());
    const log = await createActionLog({
      actor: { id: user.id, role: user.role },
      input: body
    });

    await writeAuditLog({
      userId: user.id,
      action: "action_log.create",
      entityType: "action_log",
      entityId: log.id,
      payload: { orgName: log.orgName, actionText: log.actionText, result: log.result },
      ipAddress: getMeta(req).ipAddress
    });

    await publishActionLogChange({
      actorId: user.id,
      action: "created",
      logId: log.id
    });

    return jsonOk({ log });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return jsonError(e);
  }
}
