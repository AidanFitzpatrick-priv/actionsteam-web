import type { UserRole } from "@prisma/client";
import { isRankedActionParticipant } from "@/lib/rbac";

/** Weekly attendance goal: 10 actions in the current schedule week. */
export const WEEKLY_ACTION_GOAL = 10;

export function goalMet(total: number): boolean {
  return total >= WEEKLY_ACTION_GOAL;
}

/** Team rings, filters, and charts — never AUX+ (they can still have a private self ring). */
export function teamGoalScores<T extends { role: UserRole }>(rows: T[]): T[] {
  return rows.filter(row => isRankedActionParticipant(row.role));
}
