import { describe, expect, it } from "vitest";
import { buildWeekColumns } from "@/services/goal-week";

describe("buildWeekColumns", () => {
  it("returns only days with dates (schedule-aligned)", () => {
    const week = [
      null,
      null,
      new Date(2026, 6, 1, 12, 0, 0),
      new Date(2026, 6, 2, 12, 0, 0),
      new Date(2026, 6, 3, 12, 0, 0),
      new Date(2026, 6, 4, 12, 0, 0),
      new Date(2026, 6, 5, 12, 0, 0)
    ];
    const cols = buildWeekColumns(week);
    expect(cols).toHaveLength(5);
    expect(cols[0]).toEqual({ dayIndex: 2, date: "01/07/2026" });
    expect(cols[4]).toEqual({ dayIndex: 6, date: "05/07/2026" });
  });

  it("returns full week when all seven days are in month", () => {
    const week = Array.from({ length: 7 }, (_, i) => new Date(2026, 6, 6 + i, 12, 0, 0));
    expect(buildWeekColumns(week)).toHaveLength(7);
  });
});
