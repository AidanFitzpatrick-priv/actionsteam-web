import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return jsonOk({ user: null });
    return jsonOk({ user });
  } catch (err) {
    return jsonError(err);
  }
}
