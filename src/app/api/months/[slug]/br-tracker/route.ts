import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk, requireRole, getMeta, ApiError } from "@/lib/api";
import { getMonthBySlug } from "@/services/months";
import {
  getBrTrackerRows,
  patchBrTrackerRow,
  addBrTrackerRow,
  softDeleteBrTrackerRow
} from "@/services/br-tracker";
import { parseDate } from "@/lib/dates";
import { writeAuditLog } from "@/lib/audit";
import { publishMonthBrTrackerChange } from "@/services/live-sync";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireRole("member");
    const { slug } = await ctx.params;
    const month = await getMonthBySlug(slug);
    if (!month || month.archivedAt) throw new ApiError(404, "Month not found");

    const rows = await getBrTrackerRows(month.id);
    const { getDropdownOptions, ensureBrActionTypes } = await import("@/services/reference-data");
    const { getTypeColorMap, colorForType } = await import("@/services/schedule");
    await ensureBrActionTypes();
    const [dropdowns, colorMap] = await Promise.all([
      getDropdownOptions({ typeKind: "br" }),
      getTypeColorMap()
    ]);

    return jsonOk({
      month,
      rows: rows.map(r => ({
        ...r,
        colour: colorForType(r.typeName, colorMap)
      })),
      dropdowns
    });
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
        attended: z.array(z.string()).optional(),
        firstPlace: z.string().max(500).nullable().optional(),
        secondPlace: z.string().max(500).nullable().optional(),
        thirdPlace: z.string().max(500).nullable().optional(),
        winnerComped: z.boolean().optional()
      })
      .parse(await req.json());

    if (body.action === "add") {
      const row = await addBrTrackerRow(month.id);
      await publishMonthBrTrackerChange({
        monthId: month.id,
        monthSlug: slug,
        actorId: user.id,
        action: "added",
        rowId: row.id
      });
      return jsonOk({ row });
    }

    if (body.action === "delete") {
      if (!body.rowId) throw new ApiError(400, "rowId required");
      await softDeleteBrTrackerRow(body.rowId);
      await publishMonthBrTrackerChange({
        monthId: month.id,
        monthSlug: slug,
        actorId: user.id,
        action: "deleted",
        rowId: body.rowId
      });
      return jsonOk({ ok: true });
    }

    if (!body.rowId) throw new ApiError(400, "rowId required");

    const row = await patchBrTrackerRow(body.rowId, {
      actionDate: body.actionDate !== undefined ? parseDate(body.actionDate) : undefined,
      typeName: body.typeName,
      status: body.status,
      attended: body.attended,
      firstPlace: body.firstPlace,
      secondPlace: body.secondPlace,
      thirdPlace: body.thirdPlace,
      winnerComped: body.winnerComped
    });

    const { getTypeColorMap, colorForType } = await import("@/services/schedule");
    const colorMap = await getTypeColorMap();

    await writeAuditLog({
      userId: user.id,
      action: "br_tracker.update",
      entityType: "br_tracker_row",
      entityId: row.id,
      ipAddress: meta.ipAddress
    });

    await publishMonthBrTrackerChange({
      monthId: month.id,
      monthSlug: slug,
      actorId: user.id,
      action: "updated",
      rowId: row.id
    });

    return jsonOk({ row: { ...row, colour: colorForType(row.typeName, colorMap) } });
  } catch (e) {
    return jsonError(e);
  }
}
