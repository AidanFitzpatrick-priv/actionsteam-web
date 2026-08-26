import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk, requireRole, getMeta, ApiError } from "@/lib/api";
import { publishAdminChange } from "@/services/live-sync";
import * as months from "@/services/months";

type Ctx = { params: Promise<{ slug: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireRole("aux");
    const { slug } = await ctx.params;
    const body = z
      .object({
        action: z.enum(["activate", "archive", "unarchive"])
      })
      .parse(await req.json());
    const meta = getMeta(req);

    if (body.action === "activate") {
      const month = await months.setActiveMonth({
        slug,
        actorUserId: user.id,
        ipAddress: meta.ipAddress
      });
      await publishAdminChange(user.id, "months:activate");
      return jsonOk({ month });
    }

    if (body.action === "archive") {
      const month = await months.archiveMonth({
        slug,
        actorUserId: user.id,
        ipAddress: meta.ipAddress
      });
      await publishAdminChange(user.id, "months:archive");
      return jsonOk({ month });
    }

    if (body.action === "unarchive") {
      const month = await months.unarchiveMonth({
        slug,
        actorUserId: user.id,
        ipAddress: meta.ipAddress
      });
      await publishAdminChange(user.id, "months:unarchive");
      return jsonOk({ month });
    }

    throw new ApiError(400, "Unknown action");
  } catch (e) {
    return jsonError(e);
  }
}
