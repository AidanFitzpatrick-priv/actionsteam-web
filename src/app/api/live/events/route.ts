import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireRole } from "@/lib/api";
import { fetchLiveEventsSince } from "@/services/live-sync";

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("member");
    const sinceParam = req.nextUrl.searchParams.get("since");
    const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 5000);
    if (isNaN(since.getTime())) {
      return jsonOk({ events: [] });
    }

    const monthSlug = req.nextUrl.searchParams.get("monthSlug") ?? undefined;
    const admin = req.nextUrl.searchParams.get("admin") === "1";
    const invites = req.nextUrl.searchParams.get("invites") === "1";

    const events = await fetchLiveEventsSince(since, user.role, {
      monthSlug,
      admin,
      invites
    });

    return jsonOk({ events });
  } catch (e) {
    return jsonError(e);
  }
}
