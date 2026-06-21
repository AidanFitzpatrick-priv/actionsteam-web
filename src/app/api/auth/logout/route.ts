import { NextRequest } from "next/server";
import { jsonOk, jsonError, getMeta } from "@/lib/api";
import { getCurrentUser, deleteSessionByToken, SESSION_COOKIE, clearSessionCookies } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (token) await deleteSessionByToken(token);

    if (user) {
      await writeAuditLog({
        userId: user.id,
        action: "auth.logout",
        ipAddress: getMeta(req).ipAddress
      });
    }

    const res = jsonOk({ ok: true });
    clearSessionCookies(name => res.cookies.delete(name));
    return res;
  } catch (err) {
    return jsonError(err);
  }
}
