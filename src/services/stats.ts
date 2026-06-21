/**
 * Port of ActionStats.js table builders.
 * Gang attendance Total only when Status is set (buildGangAttendanceTable_).
 */
import { normalizeStatus } from "@/lib/names";

export type StatsRow = {
  type: string;
  gang: string;
  org2: string;
  attendedList: string;
  winner: string;
  pdMembers: string | number | null;
  gangMembers: string | number | null;
  status: string;
  date: unknown;
};

function isPlaceholder(txt: unknown): boolean {
  const s = String(txt ?? "").trim().toLowerCase();
  return !s || s === "n/a" || s === "na" || s === "-" || s === "--";
}

function parseHeadcount(raw: unknown): number | null {
  if (isPlaceholder(raw)) return null;
  const n = Number(String(raw).trim());
  return isNaN(n) ? null : n;
}

function parseWinnerSide(raw: string, org1Name: string, org2Name: string): "org1" | "org2" | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (isPlaceholder(s)) return null;
  const o1 = org1Name.trim().toLowerCase();
  const o2 = org2Name.trim().toLowerCase();
  if (o1 && s === o1) return "org1";
  if (o2 && s === o2) return "org2";
  if (s === "org 1" || s === "org1") return "org1";
  if (s === "org 2" || s === "org2") return "org2";
  if (s.includes("pd") || s.includes("army")) return "org2";
  if (s.includes("gang")) return "org1";
  return null;
}

const IGNORED_TYPES = new Set([
  "monthly action points", "name", "score", "side", "group", "status group",
  "action type", "gang name", "wins", "played"
]);

export function isIgnoredTypeLabel(typeText: string): boolean {
  const low = typeText.trim().toLowerCase();
  return IGNORED_TYPES.has(low);
}

export function isRealActionRow(r: StatsRow): boolean {
  const rawType = r.type.trim();
  if (isIgnoredTypeLabel(rawType)) return false;
  const hasType = !!rawType;
  const hasGang = !!r.gang.trim();
  const hasWinner = !!r.winner.trim();
  const hasStatus = normalizeStatus(r.status).size > 0;
  return hasType || hasGang || hasWinner || hasStatus;
}

export function buildWinrateTable(rows: StatsRow[]) {
  let org1Wins = 0;
  let org2Wins = 0;

  rows.forEach(r => {
    const side = parseWinnerSide(r.winner, r.gang, r.org2);
    if (side === "org1") org1Wins++;
    else if (side === "org2") org2Wins++;
  });

  const total = org1Wins + org2Wins;
  return {
    headers: ["Side", "Wins", "Winrate %"],
    rows: [
      ["ORG 1", org1Wins, total ? Math.round((org1Wins / total) * 10000) / 100 : 0],
      ["ORG 2", org2Wins, total ? Math.round((org2Wins / total) * 10000) / 100 : 0]
    ]
  };
}

export function buildAvgMembersTable(rows: StatsRow[]) {
  let pdTotal = 0;
  let pdCount = 0;
  let gangTotal = 0;
  let gangCount = 0;

  rows.forEach(r => {
    const pd = parseHeadcount(r.pdMembers);
    const gang = parseHeadcount(r.gangMembers);
    if (pd !== null) { pdTotal += pd; pdCount++; }
    if (gang !== null) { gangTotal += gang; gangCount++; }
  });

  return {
    headers: ["Group", "Avg Members Attend"],
    rows: [
      ["PD + Army", pdCount ? Math.round((pdTotal / pdCount) * 100) / 100 : 0],
      ["Gangs Combined", gangCount ? Math.round((gangTotal / gangCount) * 100) / 100 : 0]
    ]
  };
}

export function buildStatusPctTable(rows: StatsRow[]) {
  let pdNoShow = 0;
  let gangNoShow = 0;
  let completed = 0;

  rows.forEach(r => {
    const st = normalizeStatus(r.status);
    if (!st.size) return;
    if (st.has("pd didn't attend") || st.has("org 2 didn't attend") || st.has("actions didn't attend")) pdNoShow++;
    if (st.has("gang didn't attend") || st.has("org 1 didn't attend")) gangNoShow++;
    if (st.has("completed")) completed++;
  });

  const total = pdNoShow + gangNoShow + completed;
  return {
    headers: ["Status Group", "Count", "Percent %"],
    rows: [
      ["PD Didn't Attend / Org 2 Didn't Attend", pdNoShow, total ? Math.round((pdNoShow / total) * 10000) / 100 : 0],
      ["Gang Didn't Attend / Org 1 Didn't Attend", gangNoShow, total ? Math.round((gangNoShow / total) * 10000) / 100 : 0],
      ["Completed", completed, total ? Math.round((completed / total) * 10000) / 100 : 0]
    ]
  };
}

export function buildMostPlayedTable(rows: StatsRow[]) {
  const map = new Map<string, number>();
  rows.forEach(r => {
    const type = r.type.trim();
    if (!type || isIgnoredTypeLabel(type)) return;
    map.set(type, (map.get(type) ?? 0) + 1);
  });

  return {
    headers: ["Action Type", "Played"],
    rows: [...map.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([type, count]) => [type, count])
  };
}

/** buildGangAttendanceTable_ — Total increments only when status is set. */
export function buildGangAttendanceTable(rows: StatsRow[]) {
  const stats = new Map<string, { attended: number; total: number }>();
  const ensure = (name: string) => {
    if (!stats.has(name)) stats.set(name, { attended: 0, total: 0 });
    return stats.get(name)!;
  };

  rows.forEach(r => {
    if (!r.gang.trim()) return;
    const st = normalizeStatus(r.status);
    if (!st.size) return; // no status → skip entirely (no Total increment)
    const s = ensure(r.gang);
    s.total += 1;
    if (!st.has("org 1 didn't attend") && !st.has("gang didn't attend")) s.attended += 1;
  });

  return {
    headers: ["Gang Name", "Attended", "Total", "Attendance %"],
    rows: [...stats.entries()]
      .sort((a, b) => {
        const aPct = a[1].total ? (a[1].attended / a[1].total) * 100 : 0;
        const bPct = b[1].total ? (b[1].attended / b[1].total) * 100 : 0;
        if (bPct !== aPct) return bPct - aPct;
        if (b[1].total !== a[1].total) return b[1].total - a[1].total;
        return a[0].localeCompare(b[0]);
      })
      .map(([gang, s]) => {
        const pct = s.total ? (s.attended / s.total) * 100 : 0;
        return [gang, s.attended, s.total, Math.round(pct * 100) / 100];
      })
  };
}

export function buildAllStatsTables(rows: StatsRow[], mostPlayedRows: StatsRow[]) {
  const real = rows.filter(isRealActionRow);
  return {
    winrate: buildWinrateTable(real),
    avgMembers: buildAvgMembersTable(real),
    statusPct: buildStatusPctTable(real),
    mostPlayed: buildMostPlayedTable(mostPlayedRows),
    gangAttendance: buildGangAttendanceTable(real)
  };
}
