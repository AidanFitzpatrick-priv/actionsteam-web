import { describe, it, expect } from "vitest";
import { buildGangAttendanceTable, type StatsRow } from "./stats";

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
