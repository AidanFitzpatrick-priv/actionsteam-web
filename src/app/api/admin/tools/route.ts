import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireRole, getMeta } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { recalculateAllPoints } from "@/services/points";
import { publishAdminChange, publishLiveEvent } from "@/services/live-sync";
import { z } from "zod";

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("aux");
    const body = z
      .object({
        action: z.enum(["recalculate"])
      })
      .parse(await req.json());
    const meta = getMeta(req);

    if (body.action === "recalculate") {
      const result = await recalculateAllPoints();
      await publishLiveEvent({ type: "goals.updated", scope: "global", actorId: user.id });
      await publishAdminChange(user.id, "tools:recalculate");
      await writeAuditLog({
        userId: user.id,
        action: "admin.recalculate",
        ipAddress: meta.ipAddress
      });
      return jsonOk({ ok: true, result });
    }

    return jsonOk({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
