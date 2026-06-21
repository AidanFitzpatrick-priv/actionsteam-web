import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk, requireRole, getMeta, ApiError } from "@/lib/api";
import * as ref from "@/services/reference-data";

const bodySchema = z.object({
  entity: z.enum(["staff", "types", "gangs"]),
  action: z.enum(["upsert", "delete"]),
  id: z.string().optional(),
  name: z.string().optional(),
  rank: z.string().nullable().optional(),
  active: z.boolean().optional(),
  colourHex: z.string().optional(),
  org2Eligible: z.boolean().optional()
});

export async function GET(req: NextRequest) {
  try {
    await requireRole("aux");
    const entity = req.nextUrl.searchParams.get("entity");
    if (entity === "staff") return jsonOk({ items: await ref.listStaff() });
    if (entity === "types") return jsonOk({ items: await ref.listActionTypes() });
    if (entity === "gangs") return jsonOk({ items: await ref.listGangs() });
    if (entity === "dropdowns") return jsonOk(await ref.getDropdownOptions());
    throw new ApiError(400, "Unknown entity");
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("aux");
    const body = bodySchema.parse(await req.json());
    const meta = getMeta(req);

    if (body.entity === "staff") {
      if (body.action === "delete" && body.id) {
        await ref.softDeleteStaff({ id: body.id, actorUserId: user.id, ipAddress: meta.ipAddress });
        return jsonOk({ ok: true });
      }
      if (!body.name) throw new ApiError(400, "Name required");
      const row = await ref.upsertStaff({
        id: body.id,
        name: body.name,
        rank: body.rank,
        active: body.active,
        actorUserId: user.id,
        ipAddress: meta.ipAddress
      });
      return jsonOk({ item: row });
    }

    if (body.entity === "types") {
      if (body.action === "delete" && body.id) {
        await ref.softDeleteActionType({ id: body.id, actorUserId: user.id, ipAddress: meta.ipAddress });
        return jsonOk({ ok: true });
      }
      if (!body.name || !body.colourHex) throw new ApiError(400, "Name and colour required");
      const row = await ref.upsertActionType({
        id: body.id,
        name: body.name,
        colourHex: body.colourHex,
        actorUserId: user.id,
        ipAddress: meta.ipAddress
      });
      return jsonOk({ item: row });
    }

    if (body.entity === "gangs") {
      if (body.action === "delete" && body.id) {
        await ref.softDeleteGang({ id: body.id, actorUserId: user.id, ipAddress: meta.ipAddress });
        return jsonOk({ ok: true });
      }
      if (!body.name) throw new ApiError(400, "Name required");
      const row = await ref.upsertGang({
        id: body.id,
        name: body.name,
        org2Eligible: body.org2Eligible,
        actorUserId: user.id,
        ipAddress: meta.ipAddress
      });
      return jsonOk({ item: row });
    }

    throw new ApiError(400, "Unknown entity");
  } catch (e) {
    return jsonError(e);
  }
}
