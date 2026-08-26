import { describe, expect, it } from "vitest";
import {
  buildRankedParticipants,
  rankLeaderboard,
  rowsInWeek,
  type TrackerScoreRow
} from "./leaderboard";
import { computeMonthlyActionTotals } from "@/services/points";

const mon = new Date(2026, 7, 17, 12, 0, 0);
const tue = new Date(2026, 7, 18, 12, 0, 0);
const nextMon = new Date(2026, 7, 24, 12, 0, 0);
const weekDates = [mon, tue, null, null, null, null, null];

function row(
  partial: Partial<TrackerScoreRow> & { status: string[]; actionDate: Date | null }
): TrackerScoreRow {
  return {
    hostedBy: null,
    attended: [],
    ...partial
  };
}

describe("goal scoring used by the leaderboard", () => {
  it("credits host 2 and attendees 1 on Completed", () => {
    const totals = computeMonthlyActionTotals([
      row({
        actionDate: mon,
        status: ["Completed"],
        hostedBy: "Sam",
        attended: ["Kai", "Pat"]
      })
    ]);
    expect(totals.sam).toBe(2);
    expect(totals.kai).toBe(1);
    expect(totals.pat).toBe(1);
  });

  it("still scores Org 1 / Org 2 didn't attend (Actions showed up)", () => {
    const totals = computeMonthlyActionTotals([
      row({ actionDate: mon, status: ["Org 1 Didn't Attend"], hostedBy: "Sam", attended: ["Kai"] }),
      row({ actionDate: tue, status: ["Org 2 Didn't Attend"], hostedBy: "Sam", attended: [] })
    ]);
    expect(totals.sam).toBe(4);
    expect(totals.kai).toBe(1);
  });

  it("does not treat Actions Didn't Attend as an attended action", () => {
    const totals = computeMonthlyActionTotals([
      row({
        actionDate: mon,
        status: ["Actions Didn't Attend"],
        hostedBy: "Sam",
        attended: ["Kai"]
      })
    ]);
    expect(totals.sam).toBe(-1);
    expect(totals.kai).toBeUndefined();
  });
});

describe("rowsInWeek", () => {
  it("keeps only rows whose action date is in the goal week", () => {
    const rows = [
      row({ actionDate: mon, status: ["Completed"], hostedBy: "Sam" }),
      row({ actionDate: nextMon, status: ["Completed"], hostedBy: "Sam" }),
      row({ actionDate: null, status: ["Completed"], hostedBy: "Kai" })
    ];
    const week = rowsInWeek(rows, weekDates);
    expect(week).toHaveLength(1);
    expect(computeMonthlyActionTotals(week).sam).toBe(2);
  });
});

describe("buildRankedParticipants", () => {
  it("excludes aux, adm, management, and hidden users", () => {
    const people = buildRankedParticipants(
      [
        { username: "Sam", role: "member", hiddenFromGoalTrackers: false },
        { username: "Lee", role: "sub_lead", hiddenFromGoalTrackers: false },
        { username: "Kim", role: "lead", hiddenFromGoalTrackers: false },
        { username: "AuxUser", role: "aux", hiddenFromGoalTrackers: false },
        { username: "AdmUser", role: "adm", hiddenFromGoalTrackers: false },
        { username: "admin", role: "management", hiddenFromGoalTrackers: false },
        { username: "Ghost", role: "member", hiddenFromGoalTrackers: true }
      ],
      [{ name: "StaffOnly" }]
    );
    expect(people.map(p => p.name).sort()).toEqual(["Kim", "Lee", "Sam", "StaffOnly"]);
  });

  it("drops a staff name when the matching account is AUX+", () => {
    const people = buildRankedParticipants(
      [{ username: "Kai", role: "aux", hiddenFromGoalTrackers: false }],
      [{ name: "Kai" }]
    );
    expect(people).toEqual([]);
  });
});

describe("rankLeaderboard", () => {
  it("orders by count then name, and skips AUX+ via the participant list", () => {
    const participants = buildRankedParticipants(
      [
        { username: "Zoe", role: "member", hiddenFromGoalTrackers: false },
        { username: "Amy", role: "lead", hiddenFromGoalTrackers: false },
        { username: "Boss", role: "aux", hiddenFromGoalTrackers: false }
      ],
      []
    );
    const rows = rankLeaderboard({ zoe: 3, amy: 3, boss: 99 }, participants);
    expect(rows.map(r => r.name)).toEqual(["Amy", "Zoe"]);
    expect(rows[0]).toEqual({ rank: 1, name: "Amy", count: 3 });
    expect(rows[1]).toEqual({ rank: 2, name: "Zoe", count: 3 });
  });

  it("week vs month vs all-time use different row sets", () => {
    const participants = buildRankedParticipants(
      [{ username: "Sam", role: "member", hiddenFromGoalTrackers: false }],
      []
    );
    const allRows = [
      row({ actionDate: mon, status: ["Completed"], hostedBy: "Sam" }),
      row({ actionDate: nextMon, status: ["Completed"], hostedBy: "Sam" })
    ];
    const week = rankLeaderboard(
      computeMonthlyActionTotals(rowsInWeek(allRows, weekDates)),
      participants
    );
    const allTime = rankLeaderboard(computeMonthlyActionTotals(allRows), participants);
    expect(week[0].count).toBe(2);
    expect(allTime[0].count).toBe(4);
  });
});
