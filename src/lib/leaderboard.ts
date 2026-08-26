import { UserRole } from "@prisma/client";
import { isSameYMD } from "@/lib/dates";
import { cleanName } from "@/lib/names";
import { isRankedActionParticipant } from "@/lib/rbac";

export type LeaderboardParticipant = {
  key: string;
  name: string;
  role: UserRole;
  hidden: boolean;
};

export type LeaderboardRow = {
  rank: number;
  name: string;
  count: number;
};

export type TrackerScoreRow = {
  actionDate: Date | null;
  status: string[];
  hostedBy: string | null;
  attended: string[];
};

export function rowsInWeek(
  rows: TrackerScoreRow[],
  weekDates: (Date | null)[]
): TrackerScoreRow[] {
  return rows.filter(
    row => row.actionDate && weekDates.some(d => d && isSameYMD(row.actionDate, d))
  );
}

export function buildRankedParticipants(
  users: { username: string; role: UserRole; hiddenFromGoalTrackers: boolean }[],
  staff: { name: string }[]
): LeaderboardParticipant[] {
  const byKey = new Map<string, LeaderboardParticipant>();
  for (const s of staff) {
    const key = cleanName(s.name);
    if (!key) continue;
    byKey.set(key, { key, name: s.name, role: "member", hidden: false });
  }
  for (const u of users) {
    const key = cleanName(u.username);
    if (!key) continue;
    const existing = byKey.get(key);
    byKey.set(key, {
      key,
      name: existing?.name ?? u.username,
      role: u.role,
      hidden: u.hiddenFromGoalTrackers
    });
  }
  return [...byKey.values()].filter(p => isRankedActionParticipant(p.role, p.hidden));
}

export function rankLeaderboard(
  totals: Record<string, number>,
  participants: LeaderboardParticipant[]
): LeaderboardRow[] {
  return participants
    .map(p => ({ name: p.name, count: totals[p.key] ?? 0 }))
    .sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    )
    .map((row, index) => ({ rank: index + 1, ...row }));
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}
