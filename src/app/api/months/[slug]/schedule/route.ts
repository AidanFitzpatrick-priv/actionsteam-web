import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk, requireRole, ApiError } from "@/lib/api";
import { getMonthBySlug } from "@/services/months";
import { getScheduleSlots, getTypeColorMap, colorForType } from "@/services/schedule";
import { getDropdownOptions } from "@/services/reference-data";
import { parseDate } from "@/lib/dates";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireRole("member");
    const { slug } = await ctx.params;
    const month = await getMonthBySlug(slug);
    if (!month || month.archivedAt) throw new ApiError(404, "Month not found");

    const [slots, colorMap, dropdowns] = await Promise.all([
      getScheduleSlots(month.id),
      getTypeColorMap(),
      getDropdownOptions()
    ]);

    return jsonOk({
      month,
      dropdowns,
      slots: slots.map(s => ({
        ...s,
        colour: colorForType(s.typeName, colorMap)
      }))
    });
  } catch (e) {
    return jsonError(e);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    await requireRole("member");
    const { slug } = await ctx.params;
    const month = await getMonthBySlug(slug);
    if (!month || month.archivedAt) throw new ApiError(404, "Month not found");

    const body = z
      .object({
        slotId: z.string(),
        timeText: z.string().nullable().optional(),
        typeName: z.string().nullable().optional(),
        dateBooked: z.string().nullable().optional(),
        bookedBy: z.string().nullable().optional(),
        orgName: z.string().nullable().optional()
      })
      .parse(await req.json());

    const { patchScheduleSlot } = await import("@/services/schedule");
    const slot = await patchScheduleSlot(body.slotId, {
      timeText: body.timeText,
      typeName: body.typeName,
      bookedBy: body.bookedBy,
      orgName: body.orgName,
      dateBooked: body.dateBooked ? parseDate(body.dateBooked) : body.dateBooked === null ? null : undefined
    });

    const colorMap = await getTypeColorMap();
    return jsonOk({
      slot: { ...slot, colour: colorForType(slot.typeName, colorMap) },
      message: slot.typeName && slot.orgName ? "Added to tracker" : undefined
    });
  } catch (e) {
    return jsonError(e);
  }
}
