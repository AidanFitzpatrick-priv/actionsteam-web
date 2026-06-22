import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireRole, getMeta } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { recalculateAllPoints } from "@/services/points";
import { importBundledJuneSchedule } from "@/services/import-schedule";
import { z } from "zod";

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("aux");
    const body = z
      .object({
        action: z.enum(["recalculate", "import_june_sheet"])
      })
      .parse(await req.json());
    const meta = getMeta(req);

    if (body.action === "import_june_sheet") {
      const result = await importBundledJuneSchedule();
      await writeAuditLog({
        userId: user.id,
        action: "admin.import_june_sheet",
        entityType: "month",
        entityId: result.month.id,
        payload: { updated: result.updated },
        ipAddress: meta.ipAddress
      });
      return jsonOk({ ok: true, result });
    }

    const result = await recalculateAllPoints();
    await writeAuditLog({
      userId: user.id,
      action: "admin.recalculate",
      ipAddress: meta.ipAddress
    });
    return jsonOk({ ok: true, result });
  } catch (e) {
    return jsonError(e);
  }
}
