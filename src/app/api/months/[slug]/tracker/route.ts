import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk, requireRole, getMeta, ApiError } from "@/lib/api";
import { getMonthBySlug } from "@/services/months";
import {
  getTrackerRows,
  patchTrackerRow,
  addTrackerRow,
  softDeleteTrackerRow,
  loadStatsForMonth
} from "@/services/tracker";
import { buildAllStatsTables } from "@/services/stats";
import { parseDate } from "@/lib/dates";
import { writeAuditLog } from "@/lib/audit";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireRole("member");
    const { slug } = await ctx.params;
    const month = await getMonthBySlug(slug);
    if (!month || month.archivedAt) throw new ApiError(404, "Month not found");

    const rows = await getTrackerRows(month.id);
    const { getDropdownOptions } = await import("@/services/reference-data");
    const dropdowns = await getDropdownOptions();

    return jsonOk({ month, rows, dropdowns });
  } catch (e) {
    return jsonError(e);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireRole("member");
    const { slug } = await ctx.params;
    const month = await getMonthBySlug(slug);
    if (!month || month.archivedAt) throw new ApiError(404, "Month not found");
    const meta = getMeta(req);

    const body = z
      .object({
        action: z.enum(["update", "add", "delete"]).default("update"),
        rowId: z.string().optional(),
        actionDate: z.string().nullable().optional(),
        typeName: z.string().nullable().optional(),
        status: z.array(z.string()).optional(),
        org1Name: z.string().nullable().optional(),
        org2Name: z.string().nullable().optional(),
        hostedBy: z.string().nullable().optional(),
        attended: z.array(z.string()).optional(),
        actionWinner: z.string().nullable().optional(),
        org1Attended: z.string().nullable().optional(),
        org2Attended: z.string().nullable().optional()
      })
      .parse(await req.json());

    if (body.action === "add") {
      const row = await addTrackerRow(month.id);
      return jsonOk({ row });
    }

    if (body.action === "delete") {
      if (!body.rowId) throw new ApiError(400, "rowId required");
      await softDeleteTrackerRow(body.rowId);
      return jsonOk({ ok: true });
    }

    if (!body.rowId) throw new ApiError(400, "rowId required");

    const row = await patchTrackerRow(body.rowId, {
      actionDate: body.actionDate !== undefined ? parseDate(body.actionDate) : undefined,
      typeName: body.typeName,
      status: body.status,
      org1Name: body.org1Name,
      org2Name: body.org2Name,
      hostedBy: body.hostedBy,
      attended: body.attended,
      actionWinner: body.actionWinner,
      org1Attended: body.org1Attended,
      org2Attended: body.org2Attended
    });

    let toast: string | undefined;
    if (body.actionWinner?.trim().toLowerCase() === "n/a") {
      toast = "Headcount set to N/A";
    }

    await writeAuditLog({
      userId: user.id,
      action: "tracker.update",
      entityType: "tracker_row",
      entityId: row.id,
      ipAddress: meta.ipAddress
    });

    const statsRows = await loadStatsForMonth(month.id);
    const stats = buildAllStatsTables(statsRows, statsRows);

    return jsonOk({ row, toast, stats });
  } catch (e) {
    return jsonError(e);
  }
}
