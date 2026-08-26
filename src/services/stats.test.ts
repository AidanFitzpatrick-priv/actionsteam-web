import { describe, it, expect } from "vitest";
import {
  buildGangAttendanceTable,
  buildOverview,
  monthMatchesKey,
  previousMonthKey,
  type StatsRow
} from "./stats";

describe("buildGangAttendanceTable", () => {
  it("does not increment Total when status is empty", () => {
    const rows: StatsRow[] = [
      { type: "Raid", gang: "Ballas", org2: "PD", attendedList: "", winner: "", pdMembers: null, gangMembers: null, status: "", date: null },
      { type: "Raid", gang: "Ballas", org2: "PD", attendedList: "", winner: "", pdMembers: null, gangMembers: null, status: "Completed", date: null }
    ];
    const table = buildGangAttendanceTable(rows);
    expect(table.rows).toEqual([["Ballas", 1, 1, 100]]);
  });

  it("marks attended when status set and org1 attended", () => {
    const rows: StatsRow[] = [
      { type: "Raid", gang: "Vagos", org2: "PD", attendedList: "", winner: "", pdMembers: null, gangMembers: null, status: "Org 1 Didn't Attend", date: null },
      { type: "Raid", gang: "Vagos", org2: "PD", attendedList: "", winner: "", pdMembers: null, gangMembers: null, status: "Completed", date: null }
    ];
    const table = buildGangAttendanceTable(rows);
    const vagos = table.rows.find(r => r[0] === "Vagos");
    expect(vagos).toEqual(["Vagos", 1, 2, 50]);
  });
});

function row(partial: Partial<StatsRow>): StatsRow {
  return {
    type: "Raid",
    gang: "Ballas",
    org2: "PD",
    attendedList: "",
    winner: "",
    pdMembers: null,
    gangMembers: null,
    status: "Completed",
    date: null,
    ...partial
  };
}

describe("buildOverview", () => {
  it("counts completion, pending, and last-month total", () => {
    const rows: StatsRow[] = [
      row({ date: new Date(2026, 7, 18), status: "Completed" }),
      row({ date: new Date(2026, 7, 19), status: "Completed" }),
      row({ date: new Date(2026, 7, 20), status: "" }),
      row({ date: new Date(2026, 7, 11), status: "Completed" }),
      row({ date: new Date(2026, 7, 10), status: "Org 1 Didn't Attend" })
    ];
    const overview = buildOverview(rows, { lastMonthTotal: 9 });
    expect(overview.total).toBe(5);
    expect(overview.completed).toBe(3);
    expect(overview.pending).toBe(1);
    expect(overview.lastMonthTotal).toBe(9);
    expect(overview.completionPct).toBe(75);
  });
});

describe("previousMonthKey", () => {
  it("rolls January back to December of the prior year", () => {
    expect(previousMonthKey({ name: "January", year: 2026, createdAt: new Date("2026-01-01") })).toEqual({
      name: "December",
      year: 2025
    });
  });

  it("matches a stored month against that key", () => {
    const key = previousMonthKey({ name: "August", year: 2026, createdAt: new Date("2026-08-01") });
    expect(key).toEqual({ name: "July", year: 2026 });
    expect(monthMatchesKey({ name: "July", year: 2026, createdAt: new Date("2026-07-01") }, key!)).toBe(true);
    expect(monthMatchesKey({ name: "June", year: 2026, createdAt: new Date("2026-06-01") }, key!)).toBe(false);
  });
});
