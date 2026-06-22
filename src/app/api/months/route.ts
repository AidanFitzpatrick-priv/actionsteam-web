import { jsonError, jsonOk, requireRole } from "@/lib/api";
import { listMonths } from "@/services/months";

export async function GET() {
  try {
    await requireRole("member");
    const months = await listMonths(false);
    return jsonOk({
      months: months.map(m => ({
        id: m.id,
        name: m.name,
        slug: m.slug,
        year: m.year,
        isActive: m.isActive
      }))
    });
  } catch (e) {
    return jsonError(e);
  }
}
