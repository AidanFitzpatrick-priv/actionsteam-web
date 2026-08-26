import { jsonError, jsonOk, requireRole } from "@/lib/api";
import { loadLeaderboard } from "@/services/leaderboard";

export async function GET() {
  try {
    await requireRole("member");
    const data = await loadLeaderboard();
    return jsonOk(data);
  } catch (e) {
    return jsonError(e);
  }
}
