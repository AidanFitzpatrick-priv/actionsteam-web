import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireRole, getMeta } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { recalculateAllPoints } from "@/services/points";
import { importScheduleToTracker } from "@/services/schedule-sync";
import { prisma } from "@/lib/db";
import { z } from "zod";

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("aux");
    const body = z
      .object({
        action: z.enum(["recalculate", "import_schedule"]),
        monthId: z.string().optional()
      })
      .parse(await req.json());
    const meta = getMeta(req);

    if (body.action === "recalculate") {
      const result = await recalculateAllPoints();
      await writeAuditLog({
        userId: user.id,
        action: "admin.recalculate",
        ipAddress: meta.ipAddress
      });
      return jsonOk({ ok: true, result });
    }

    const month = body.monthId
      ? await prisma.month.findUnique({ where: { id: body.monthId } })
      : await prisma.month.findFirst({ where: { isActive: true, archivedAt: null } });

    if (!month) return jsonOk({ ok: false, error: "No month found" });

    await importScheduleToTracker(month.id);
    await writeAuditLog({
      userId: user.id,
      action: "admin.import_schedule",
      entityType: "month",
      entityId: month.id,
      ipAddress: meta.ipAddress
    });

    return jsonOk({ ok: true, monthId: month.id });
  } catch (e) {
    return jsonError(e);
  }
}
