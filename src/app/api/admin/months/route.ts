import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk, requireRole, getMeta } from "@/lib/api";
import * as months from "@/services/months";

export async function GET() {
  try {
    await requireRole("member");
    const monthsList = await months.listMonths(true);
    return jsonOk({ months: monthsList });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("aux");
    const body = z.object({ name: z.string().min(1).max(80) }).parse(await req.json());
    const meta = getMeta(req);
    const month = await months.createMonth({
      name: body.name,
      actorUserId: user.id,
      ipAddress: meta.ipAddress
    });
    return jsonOk({ month }, { status: 201 });
  } catch (e) {
    return jsonError(e);
  }
}
