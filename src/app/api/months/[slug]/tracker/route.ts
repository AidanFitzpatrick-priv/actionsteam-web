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
import { recalculateAllPoints } from "@/services/points";
import { parseDate } from "@/lib/dates";
import { writeAuditLog } from "@/lib/audit";
import { publishMonthTrackerChange, publishTrackerDerivedUpdates } from "@/services/live-sync";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireRole("member");
    const { slug } = await ctx.params;
    const month = await getMonthBySlug(slug);
    if (!month || month.archivedAt) throw new ApiError(404, "Month not found");

    const rows = await getTrackerRows(month.id);
    const { getDropdownOptions } = await import("@/services/reference-data");
    const { getTypeColorMap, colorForType } = await import("@/services/schedule");
    const [dropdowns, colorMap] = await Promise.all([getDropdownOptions(), getTypeColorMap()]);

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
        org1Name: z.string().nullable().optional(),
        org2Name: z.string().nullable().optional(),
        hostedBy: z.string().nullable().optional(),
        attended: z.array(z.string()).optional(),
        idsText: z.string().max(500).nullable().optional(),
        winnerComped: z.boolean().optional(),
        actionWinner: z.string().nullable().optional(),
        org1Attended: z.string().nullable().optional(),
        org2Attended: z.string().nullable().optional()
      })
      .parse(await req.json());

    if (body.action === "add") {
      const row = await addTrackerRow(month.id);
      await publishMonthTrackerChange({
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
      await softDeleteTrackerRow(body.rowId);
      await publishMonthTrackerChange({
        monthId: month.id,
        monthSlug: slug,
        actorId: user.id,
        action: "deleted",
        rowId: body.rowId
      });
      void recalculateAllPoints().then(() =>
        publishTrackerDerivedUpdates({
          monthId: month.id,
          monthSlug: slug,
          actorId: user.id
        })
      );
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
      idsText: body.idsText,
      winnerComped: body.winnerComped,
      actionWinner: body.actionWinner,
      org1Attended: body.org1Attended,
      org2Attended: body.org2Attended
    });

    const { getTypeColorMap, colorForType } = await import("@/services/schedule");
    const colorMap = await getTypeColorMap();

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

    await publishMonthTrackerChange({
      monthId: month.id,
      monthSlug: slug,
      actorId: user.id,
      action: "updated",
      rowId: row.id
    });

    void recalculateAllPoints().then(() =>
      publishTrackerDerivedUpdates({
        monthId: month.id,
        monthSlug: slug,
        actorId: user.id
      })
    );

    return jsonOk({ row: { ...row, colour: colorForType(row.typeName, colorMap) }, toast, stats });
  } catch (e) {
    return jsonError(e);
  }
}
